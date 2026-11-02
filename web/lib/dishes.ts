import "server-only";
import { run, transaction } from "@/lib/db";
import { HALLS } from "@/lib/halls";
import { MEALS, type MenuData } from "@/lib/types";
import { randomUsername } from "@/lib/usernames";

// The database. Dishes are keyed by name alone, so "Chicken Tenders" is one dish whichever hall serves it, and its
// thumbs and reviews follow it from hall to hall. Where and when a dish was served is kept separately (dish_servings),
// and each review remembers the hall, day and meal it was written from, which is the flair it shows in the Feed.
//
// The social side follows the usual design of community apps (Reddit, Instagram and the like):
//   * one posts table for everything in the Feed. kind 'review' is a review of a dish (one per person per dish),
//     kind 'post' is anything else, with an optional photo and dining hall flair;
//   * comments point at a post, with a parent_id ready for replies to replies;
//   * votes live in their own tables with one row per person per post or comment, so nobody can vote twice. The
//     score and comment count are also kept on the post itself by triggers, so the Feed never has to count them;
//   * reports point at a post or a comment, one per person;
//   * people are stored by an id that is never shown; others only ever see the username in profiles.
//
// Every statement below is safe to run again. They run when SCHEMA_VERSION changes (see ensureSchema).

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS dishes (
     name text PRIMARY KEY,
     thumbs_up integer NOT NULL DEFAULT 0,
     first_seen timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS dish_likes (
     dish text NOT NULL REFERENCES dishes (name) ON DELETE CASCADE,
     user_id text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (dish, user_id)
   )`,
  // The first version of reviews. Kept, untouched, so nothing is lost; they were copied into posts (below).
  `CREATE TABLE IF NOT EXISTS dish_reviews (
     dish text NOT NULL REFERENCES dishes (name) ON DELETE CASCADE,
     user_id text NOT NULL,
     user_name text NOT NULL,
     body text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (dish, user_id)
   )`,
  "ALTER TABLE dishes ADD COLUMN IF NOT EXISTS thumbs_down integer NOT NULL DEFAULT 0",
  "ALTER TABLE dish_likes ADD COLUMN IF NOT EXISTS value smallint NOT NULL DEFAULT 1 CHECK (value IN (1, -1))",
  // The difference (thumbs ups minus thumbs downs), kept in step by the database itself. Not used for ordering the menu.
  "ALTER TABLE dishes ADD COLUMN IF NOT EXISTS score integer GENERATED ALWAYS AS (thumbs_up - thumbs_down) STORED",
  "ALTER TABLE dish_reviews ADD COLUMN IF NOT EXISTS id bigserial UNIQUE",
  `CREATE TABLE IF NOT EXISTS review_reports (
     review_id bigint NOT NULL REFERENCES dish_reviews (id) ON DELETE CASCADE,
     reporter_id text NOT NULL,
     reason text,
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (review_id, reporter_id)
   )`,

  // ---- Where and when each dish is served: one row per dish, hall, day and meal, written whenever the menus are
  // fetched. It's how alerts know a dish is on today, how weekly bests will know what was served, and how old
  // reviews (written before reviews remembered their hall) get a hall.
  `CREATE TABLE IF NOT EXISTS dish_servings (
     dish text NOT NULL REFERENCES dishes (name) ON DELETE CASCADE,
     hall text NOT NULL,
     served_on date NOT NULL,
     meal text NOT NULL,
     PRIMARY KEY (dish, hall, served_on, meal)
   )`,
  "CREATE INDEX IF NOT EXISTS dish_servings_day ON dish_servings (served_on, hall)",

  // ---- Every thumbs tap, kept forever (dish_likes only holds each person's latest), so a week's most popular dish
  // can be counted later. value 0 means the vote was taken back.
  `CREATE TABLE IF NOT EXISTS vote_events (
     id bigserial PRIMARY KEY,
     dish text NOT NULL,
     user_id text NOT NULL,
     value smallint NOT NULL CHECK (value IN (-1, 0, 1)),
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  "CREATE INDEX IF NOT EXISTS vote_events_time ON vote_events (created_at)",

  // ---- One profile per person. The unique index ignores capitals, so "Brandon" and "brandon" can't both exist.
  `CREATE TABLE IF NOT EXISTS profiles (
     user_id text PRIMARY KEY,
     username text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     username_changed_at timestamptz,
     feed_seen_at timestamptz NOT NULL DEFAULT now()
   )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower ON profiles (lower(username))",

  // ---- The Feed.
  `CREATE TABLE IF NOT EXISTS posts (
     id bigserial PRIMARY KEY,
     kind text NOT NULL CHECK (kind IN ('review', 'post')),
     user_id text NOT NULL,
     dish text REFERENCES dishes (name) ON DELETE CASCADE,
     hall text,
     served_on date,
     meal text,
     body text NOT NULL DEFAULT '',
     score integer NOT NULL DEFAULT 0,
     comment_count integer NOT NULL DEFAULT 0,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     legacy_review_id bigint UNIQUE,
     CHECK (kind <> 'review' OR dish IS NOT NULL)
   )`,
  // One review per person per dish; writing again edits it.
  "CREATE UNIQUE INDEX IF NOT EXISTS posts_one_review ON posts (user_id, dish) WHERE kind = 'review'",
  // Newest first, with the id breaking ties, so the Feed pages by (created_at, id) without skipping or repeating.
  "CREATE INDEX IF NOT EXISTS posts_feed ON posts (created_at DESC, id DESC)",
  "CREATE INDEX IF NOT EXISTS posts_by_user ON posts (user_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS posts_by_dish ON posts (dish, created_at DESC) WHERE kind = 'review'",

  // Photos are files in Vercel Blob; this is the record of each one. post_id is empty from the upload until the
  // post is saved. position leaves room for more than one photo per post later.
  `CREATE TABLE IF NOT EXISTS photos (
     id bigserial PRIMARY KEY,
     user_id text NOT NULL,
     post_id bigint REFERENCES posts (id) ON DELETE CASCADE,
     position smallint NOT NULL DEFAULT 0,
     url text NOT NULL,
     storage_key text NOT NULL,
     width integer NOT NULL,
     height integer NOT NULL,
     bytes integer NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  "CREATE INDEX IF NOT EXISTS photos_post ON photos (post_id, position)",
  "CREATE INDEX IF NOT EXISTS photos_by_user ON photos (user_id, created_at)",

  `CREATE TABLE IF NOT EXISTS post_votes (
     post_id bigint NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
     user_id text NOT NULL,
     value smallint NOT NULL CHECK (value IN (1, -1)),
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (post_id, user_id)
   )`,

  `CREATE TABLE IF NOT EXISTS comments (
     id bigserial PRIMARY KEY,
     post_id bigint NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
     parent_id bigint REFERENCES comments (id) ON DELETE CASCADE,
     user_id text NOT NULL,
     body text NOT NULL,
     score integer NOT NULL DEFAULT 0,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  "CREATE INDEX IF NOT EXISTS comments_post ON comments (post_id, created_at)",
  "CREATE INDEX IF NOT EXISTS comments_by_user ON comments (user_id, created_at DESC)",

  `CREATE TABLE IF NOT EXISTS comment_votes (
     comment_id bigint NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
     user_id text NOT NULL,
     value smallint NOT NULL CHECK (value IN (1, -1)),
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (comment_id, user_id)
   )`,

  // A report is about a post (a review is a post) or a comment, never both. Each person can report each one once.
  `CREATE TABLE IF NOT EXISTS reports (
     id bigserial PRIMARY KEY,
     post_id bigint REFERENCES posts (id) ON DELETE CASCADE,
     comment_id bigint REFERENCES comments (id) ON DELETE CASCADE,
     reporter_id text NOT NULL,
     reason text,
     created_at timestamptz NOT NULL DEFAULT now(),
     CHECK ((post_id IS NULL) <> (comment_id IS NULL))
   )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS reports_post_once ON reports (post_id, reporter_id) WHERE post_id IS NOT NULL",
  "CREATE UNIQUE INDEX IF NOT EXISTS reports_comment_once ON reports (comment_id, reporter_id) WHERE comment_id IS NOT NULL",

  // ---- Alerts for liked dishes. No row means alerts are off: nobody gets an email they didn't ask for.
  `CREATE TABLE IF NOT EXISTS notification_prefs (
     user_id text PRIMARY KEY,
     alerts boolean NOT NULL DEFAULT false,
     email boolean NOT NULL DEFAULT true,
     push boolean NOT NULL DEFAULT false,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  // Liked dishes someone switched off.
  `CREATE TABLE IF NOT EXISTS alert_mutes (
     user_id text NOT NULL,
     dish text NOT NULL,
     PRIMARY KEY (user_id, dish)
   )`,
  // One row per phone or browser that allowed notifications.
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
     endpoint text PRIMARY KEY,
     user_id text NOT NULL,
     p256dh text NOT NULL,
     auth text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  "CREATE INDEX IF NOT EXISTS push_by_user ON push_subscriptions (user_id)",

  // ---- Triggers keep the score and comment count on each post (and the score on each comment) exactly in step
  // with the vote and comment rows, in the same transaction as the change.
  `CREATE OR REPLACE FUNCTION hameats_post_votes() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN
     IF TG_OP IN ('INSERT', 'UPDATE') THEN UPDATE posts SET score = score + NEW.value WHERE id = NEW.post_id; END IF;
     IF TG_OP IN ('DELETE', 'UPDATE') THEN UPDATE posts SET score = score - OLD.value WHERE id = OLD.post_id; END IF;
     RETURN NULL;
   END $$`,
  "CREATE OR REPLACE TRIGGER post_votes_score AFTER INSERT OR UPDATE OR DELETE ON post_votes FOR EACH ROW EXECUTE FUNCTION hameats_post_votes()",
  `CREATE OR REPLACE FUNCTION hameats_comment_votes() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN
     IF TG_OP IN ('INSERT', 'UPDATE') THEN UPDATE comments SET score = score + NEW.value WHERE id = NEW.comment_id; END IF;
     IF TG_OP IN ('DELETE', 'UPDATE') THEN UPDATE comments SET score = score - OLD.value WHERE id = OLD.comment_id; END IF;
     RETURN NULL;
   END $$`,
  "CREATE OR REPLACE TRIGGER comment_votes_score AFTER INSERT OR UPDATE OR DELETE ON comment_votes FOR EACH ROW EXECUTE FUNCTION hameats_comment_votes()",
  `CREATE OR REPLACE FUNCTION hameats_comment_count() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN
     IF TG_OP = 'INSERT' THEN UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id; END IF;
     IF TG_OP = 'DELETE' THEN UPDATE posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id; END IF;
     RETURN NULL;
   END $$`,
  "CREATE OR REPLACE TRIGGER comments_count AFTER INSERT OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION hameats_comment_count()",

  // ---- Copy the first version's reviews and reports across, once (legacy_review_id stops a second copy).
  `INSERT INTO posts (kind, user_id, dish, body, created_at, updated_at, legacy_review_id)
   SELECT 'review', user_id, dish, body, created_at, updated_at, id FROM dish_reviews
   ON CONFLICT DO NOTHING`,
  `INSERT INTO reports (post_id, reporter_id, reason, created_at)
   SELECT p.id, rr.reporter_id, rr.reason, rr.created_at
   FROM review_reports rr JOIN posts p ON p.legacy_review_id = rr.review_id
   ON CONFLICT DO NOTHING`,

  "CREATE TABLE IF NOT EXISTS schema_meta (id integer PRIMARY KEY CHECK (id = 1), version integer NOT NULL)",

  // What the AI photo check (lib/photoCheck.ts) decided: null until it has looked, then 'allowed' or 'rejected' ('restored' once the owner puts a hidden post back).
  "ALTER TABLE photos ADD COLUMN IF NOT EXISTS ai_verdict text",
  // Set when the AI photo check hides a post (it's then shown to nobody); cleared by the Restore link in Discord.
  "ALTER TABLE posts ADD COLUMN IF NOT EXISTS hidden_by_ai_at timestamptz",
  // When the person agreed to the Rules (/rules), on the welcome screen after their first login. Null: not yet.
  "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rules_accepted_at timestamptz",
];

/** Bump whenever SCHEMA changes, so every server runs the new statements once. */
const SCHEMA_VERSION = 5;

/** A post or comment stops being shown to other students once this many different people have reported it. */
export const REPORTS_TO_HIDE = 3;

/**
 * SQL: whether the post aliased `p` can be seen by the person looking ($1). A post hidden by reports or by the AI photo
 * check is shown to nobody but its author, who sees it marked as hidden (see POST_HIDDEN), like Reddit's "removed" label.
 */
export const POST_VISIBLE = `(p.user_id = $1 OR (p.hidden_by_ai_at IS NULL AND (SELECT count(*) FROM reports x WHERE x.post_id = p.id) < ${REPORTS_TO_HIDE}))`;

/** SQL: why the post aliased `p` is hidden from everyone else: 'ai' (the photo filter), 'reports', or null. */
export const POST_HIDDEN = `CASE WHEN p.hidden_by_ai_at IS NOT NULL THEN 'ai'
  WHEN (SELECT count(*) FROM reports x WHERE x.post_id = p.id) >= ${REPORTS_TO_HIDE} THEN 'reports' END`;

let schemaReady: Promise<void> | undefined;

/**
 * Creates or updates the tables the first time anything needs them. A server that finds the current version already
 * recorded does one quick read and nothing else, so only the first request after a change runs the statements.
 */
export function ensureSchema() {
  schemaReady ??= (async () => {
    const current = await run("SELECT version FROM schema_meta WHERE id = 1").catch(() => []);
    if (Number(current[0]?.version) === SCHEMA_VERSION) return;
    for (const statement of SCHEMA) await run(statement);
    await createMissingProfiles();
    await run(
      "INSERT INTO schema_meta (id, version) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version",
      [SCHEMA_VERSION],
    );
  })().catch((e) => {
    schemaReady = undefined;
    throw e;
  });
  return schemaReady;
}

/** Gives a username to anyone who wrote something before usernames existed. */
async function createMissingProfiles() {
  const rows = await run(
    `SELECT DISTINCT user_id FROM (SELECT user_id FROM posts UNION SELECT user_id FROM comments) w
     WHERE NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.user_id = w.user_id)`,
  );
  for (const r of rows) await createProfile(r.user_id as string);
}

/**
 * The person's username, creating their profile with a random one the first time. A random name that happens to be
 * taken is caught by the unique index, and another is tried.
 */
export async function createProfile(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const name = attempt < 6 ? randomUsername() : `${randomUsername().slice(0, 14)}_${Math.floor(Math.random() * 100000)}`;
    const rows = await run(
      `INSERT INTO profiles (user_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING username`,
      [userId, name],
    );
    if (rows.length) return rows[0].username as string;
    const existing = await run("SELECT username FROM profiles WHERE user_id = $1", [userId]);
    if (existing.length) return existing[0].username as string;
  }
  throw new Error("could not pick a username");
}

/** Every dish name in the menus: what the menu source posted plus the hand-added specials and standing menus. */
export function dishNames(data: MenuData): string[] {
  const names = new Set<string>();
  for (const day of Object.values(data.dates))
    for (const meals of Object.values(day))
      for (const stations of Object.values(meals))
        for (const items of Object.values(stations))
          for (const item of items) if (item.name.trim()) names.add(item.name.trim());
  return [...names];
}

/** Every (dish, hall, day, meal) in the menus. */
export function dishServings(data: MenuData) {
  const rows = { dish: [] as string[], hall: [] as string[], day: [] as string[], meal: [] as string[] };
  const seen = new Set<string>();
  for (const [day, locations] of Object.entries(data.dates)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    for (const [location, meals] of Object.entries(locations)) {
      const hall = HALLS.find((h) => h.name === location)?.slug;
      if (!hall) continue;
      for (const [meal, stations] of Object.entries(meals)) {
        if (!(MEALS as readonly string[]).includes(meal)) continue;
        for (const items of Object.values(stations))
          for (const item of items) {
            const dish = item.name.trim();
            const key = `${dish}\u0000${hall}\u0000${day}\u0000${meal}`;
            if (!dish || seen.has(key)) continue;
            seen.add(key);
            rows.dish.push(dish);
            rows.hall.push(hall);
            rows.day.push(day);
            rows.meal.push(meal);
          }
      }
    }
  }
  return rows;
}

/**
 * Saves the names of any dishes not seen before and where and when each is served. Then old reviews, written before
 * reviews remembered their hall, get one when their dish has only ever been served at a single hall.
 */
export async function recordMenu(data: MenuData) {
  const names = dishNames(data);
  if (!names.length) return;
  await ensureSchema();
  await run("INSERT INTO dishes (name) SELECT DISTINCT unnest($1::text[]) ON CONFLICT (name) DO NOTHING", [names]);
  const s = dishServings(data);
  await run(
    `INSERT INTO dish_servings (dish, hall, served_on, meal)
     SELECT * FROM unnest($1::text[], $2::text[], $3::date[], $4::text[]) ON CONFLICT DO NOTHING`,
    [s.dish, s.hall, s.day, s.meal],
  );
  await run(
    `UPDATE posts p SET hall = one.hall
     FROM (SELECT dish, min(hall) AS hall FROM dish_servings GROUP BY dish HAVING count(DISTINCT hall) = 1) one
     WHERE p.kind = 'review' AND p.hall IS NULL AND p.legacy_review_id IS NOT NULL AND p.dish = one.dish`,
  );
}

export type Vote = 1 | -1 | 0;

/** SQL: the number of reviews of the dish aliased `d` that others can see. */
const VISIBLE_REVIEWS = `(SELECT count(*) FROM posts p WHERE p.kind = 'review' AND p.dish = d.name
  AND (SELECT count(*) FROM reports x WHERE x.post_id = p.id) < ${REPORTS_TO_HIDE})`;

/** Every dish with a vote or a review: its thumbs ups, thumbs downs and review count. For a signed-in person, also their own vote on each dish. */
export async function getLikeState(userId: string | undefined) {
  await ensureSchema();
  const [votes, mine] = await Promise.all([
    run(`SELECT d.name, d.thumbs_up, d.thumbs_down, d.score, ${VISIBLE_REVIEWS} AS reviews FROM dishes d
         WHERE d.thumbs_up > 0 OR d.thumbs_down > 0 OR EXISTS (SELECT 1 FROM posts p WHERE p.kind = 'review' AND p.dish = d.name)`),
    userId ? run("SELECT dish, value FROM dish_likes WHERE user_id = $1", [userId]) : Promise.resolve([]),
  ]);
  const counts: Record<string, { up: number; down: number; score: number; reviews: number }> = {};
  for (const r of votes)
    counts[r.name as string] = { up: Number(r.thumbs_up), down: Number(r.thumbs_down), score: Number(r.score), reviews: Number(r.reviews) };
  return {
    counts,
    mine: Object.fromEntries(mine.map((r) => [r.dish as string, Number(r.value)])),
  };
}

/** Sets a person's vote on a dish: 1 thumbs up, -1 thumbs down, 0 takes it back. Null when HamEats hasn't shown the dish. */
export async function setVote(dish: string, userId: string, vote: Vote) {
  await ensureSchema();
  const results = await transaction([
    // Locks the dish so two people tapping at once can't miscount.
    ["SELECT name FROM dishes WHERE name = $1 FOR UPDATE", [dish]],
    vote === 0
      ? ["DELETE FROM dish_likes WHERE dish = $1 AND user_id = $2", [dish, userId]]
      : [
          `INSERT INTO dish_likes (dish, user_id, value) SELECT name, $2::text, $3::smallint FROM dishes WHERE name = $1
           ON CONFLICT (dish, user_id) DO UPDATE SET value = EXCLUDED.value, created_at = now()`,
          [dish, userId, vote],
        ],
    [
      `UPDATE dishes SET
         thumbs_up = (SELECT count(*) FROM dish_likes WHERE dish = $1 AND value = 1),
         thumbs_down = (SELECT count(*) FROM dish_likes WHERE dish = $1 AND value = -1)
       WHERE name = $1 RETURNING thumbs_up, thumbs_down`,
      [dish],
    ],
    ["SELECT COALESCE((SELECT value FROM dish_likes WHERE dish = $1 AND user_id = $2), 0) AS vote", [dish, userId]],
    ["INSERT INTO vote_events (dish, user_id, value) SELECT name, $2::text, $3::smallint FROM dishes WHERE name = $1", [dish, userId, vote]],
  ]);
  if (!results[0].length) return null;
  return { up: Number(results[2][0].thumbs_up), down: Number(results[2][0].thumbs_down), vote: Number(results[3][0].vote) };
}

/** Where a review was written from: the hall card, day and meal the person was looking at on the Menu. */
export type ReviewPlace = { hall: string; date: string | null; meal: string | null };

export type Review = {
  id: number;
  name: string;
  body: string;
  createdAt: string;
  mine: boolean;
  reported: boolean;
  /** Hall slug, or null for an old review whose hall isn't known. */
  hall: string | null;
  /** The author's thumbs on the dish: 1, -1, or 0 when they haven't given one. */
  verdict: number;
};

/** A dish's reviews, newest first. Reviews with enough reports are left out, except for the person who wrote them. */
export async function getReviews(dish: string, userId: string | undefined): Promise<Review[]> {
  await ensureSchema();
  const rows = await run(
    `SELECT p.id, p.user_id = $1 AS mine, COALESCE(pr.username, 'student') AS username, p.body, p.created_at, p.hall,
            COALESCE((SELECT value FROM dish_likes l WHERE l.dish = p.dish AND l.user_id = p.user_id), 0) AS verdict,
            EXISTS (SELECT 1 FROM reports x WHERE x.post_id = p.id AND x.reporter_id = $1) AS reported
     FROM posts p LEFT JOIN profiles pr ON pr.user_id = p.user_id
     WHERE p.kind = 'review' AND p.dish = $2 AND ${POST_VISIBLE}
     ORDER BY p.created_at DESC, p.id DESC LIMIT 100`,
    [userId ?? "", dish],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: r.username as string,
    body: r.body as string,
    createdAt: new Date(r.created_at as string).toISOString(),
    mine: r.mine === true,
    reported: r.reported === true,
    hall: (r.hall as string | null) ?? null,
    verdict: Number(r.verdict),
  }));
}

/**
 * One review per person per dish: writing again replaces the words and keeps where it was first written from. Returns
 * the review's post id, or null when the dish isn't one HamEats has shown.
 */
export async function saveReview(dish: string, userId: string, body: string, place: ReviewPlace | null) {
  await ensureSchema();
  await ensureProfile(userId);
  const rows = await run(
    `INSERT INTO posts (kind, user_id, dish, hall, served_on, meal, body)
     SELECT 'review', $2, name, $3, $4::date, $5, $6 FROM dishes WHERE name = $1
     ON CONFLICT (user_id, dish) WHERE kind = 'review' DO UPDATE SET
       body = EXCLUDED.body,
       updated_at = now(),
       hall = COALESCE(posts.hall, EXCLUDED.hall),
       served_on = COALESCE(posts.served_on, EXCLUDED.served_on),
       meal = COALESCE(posts.meal, EXCLUDED.meal)
     RETURNING id`,
    [dish, userId, place?.hall ?? null, place?.date ?? null, place?.meal ?? null, body],
  );
  return rows.length ? Number(rows[0].id) : null;
}

export async function deleteReview(dish: string, userId: string) {
  await ensureSchema();
  await run("DELETE FROM posts WHERE kind = 'review' AND dish = $1 AND user_id = $2", [dish, userId]);
}

/** The person's username, giving them one first if they don't have one yet. */
export async function ensureProfile(userId: string): Promise<string> {
  const rows = await run("SELECT username FROM profiles WHERE user_id = $1", [userId]);
  return rows.length ? (rows[0].username as string) : createProfile(userId);
}

export const REPORT_REASONS = [
  "Offensive or hateful",
  "Harassment or targets someone",
  "Spam",
  "Not about food",
  "Something else",
] as const;

export type ReportResult =
  | { status: "missing" }
  | { status: "own" }
  | { status: "duplicate" }
  | { status: "reported"; count: number; what: string; body: string; author: string };

/** Records that `reporterId` reported a post or review. Nobody can report their own, or report one twice. */
export async function reportPost(postId: number, reporterId: string, reason: string): Promise<ReportResult> {
  await ensureSchema();
  const found = await run(
    `SELECT p.kind, p.dish, p.user_id, p.body, COALESCE(pr.username, 'student') AS username
     FROM posts p LEFT JOIN profiles pr ON pr.user_id = p.user_id WHERE p.id = $1`,
    [postId],
  );
  if (!found.length) return { status: "missing" };
  const post = found[0];
  if (post.user_id === reporterId) return { status: "own" };
  const inserted = await run(
    "INSERT INTO reports (post_id, reporter_id, reason) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1 AS ok",
    [postId, reporterId, reason || null],
  );
  if (!inserted.length) return { status: "duplicate" };
  const [{ n }] = await run("SELECT count(*) AS n FROM reports WHERE post_id = $1", [postId]);
  return {
    status: "reported",
    count: Number(n),
    what: post.kind === "review" ? `Review of ${post.dish}` : "Post",
    body: post.body as string,
    author: post.username as string,
  };
}

/** Records that `reporterId` reported a comment. */
export async function reportComment(commentId: number, reporterId: string, reason: string): Promise<ReportResult> {
  await ensureSchema();
  const found = await run(
    `SELECT c.user_id, c.body, COALESCE(pr.username, 'student') AS username
     FROM comments c LEFT JOIN profiles pr ON pr.user_id = c.user_id WHERE c.id = $1`,
    [commentId],
  );
  if (!found.length) return { status: "missing" };
  const comment = found[0];
  if (comment.user_id === reporterId) return { status: "own" };
  const inserted = await run(
    "INSERT INTO reports (comment_id, reporter_id, reason) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1 AS ok",
    [commentId, reporterId, reason || null],
  );
  if (!inserted.length) return { status: "duplicate" };
  const [{ n }] = await run("SELECT count(*) AS n FROM reports WHERE comment_id = $1", [commentId]);
  return { status: "reported", count: Number(n), what: "Comment", body: comment.body as string, author: comment.username as string };
}
