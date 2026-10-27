import "server-only";
import { run, transaction } from "@/lib/db";
import type { MenuData } from "@/lib/types";

// Every dish name HamEats has ever shown, with its thumbs-up and thumbs-down counts and their difference (score), who gave them (dish_likes holds one
// vote per person per dish: value 1 is a thumbs up, -1 a thumbs down), and the reviews written about it.
// Dishes are keyed by name alone, so "Chicken Tenders" is one dish whichever hall serves it.

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
  `CREATE TABLE IF NOT EXISTS dish_reviews (
     dish text NOT NULL REFERENCES dishes (name) ON DELETE CASCADE,
     user_id text NOT NULL,
     user_name text NOT NULL,
     body text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (dish, user_id)
   )`,
  // Added after the first release; harmless to run again.
  "ALTER TABLE dishes ADD COLUMN IF NOT EXISTS thumbs_down integer NOT NULL DEFAULT 0",
  "ALTER TABLE dish_likes ADD COLUMN IF NOT EXISTS value smallint NOT NULL DEFAULT 1 CHECK (value IN (1, -1))",
  // The difference (thumbs ups minus thumbs downs), kept in step by the database itself. Not used for ordering the menu.
  "ALTER TABLE dishes ADD COLUMN IF NOT EXISTS score integer GENERATED ALWAYS AS (thumbs_up - thumbs_down) STORED",
  // A stable id for each review, so a report can point at one without exposing who wrote it.
  "ALTER TABLE dish_reviews ADD COLUMN IF NOT EXISTS id bigserial UNIQUE",
  // One row per person per review they reported.
  `CREATE TABLE IF NOT EXISTS review_reports (
     review_id bigint NOT NULL REFERENCES dish_reviews (id) ON DELETE CASCADE,
     reporter_id text NOT NULL,
     reason text,
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (review_id, reporter_id)
   )`,
];

/** A review stops being shown to other students once this many different people have reported it. */
export const REPORTS_TO_HIDE = 3;

/** SQL: the number of reports on the review aliased `r`. */
const REPORT_COUNT = "(SELECT count(*) FROM review_reports x WHERE x.review_id = r.id)";

let schemaReady: Promise<void> | undefined;

/** Creates the tables the first time anything needs them. Safe to run again. */
function ensureSchema() {
  schemaReady ??= (async () => {
    for (const statement of SCHEMA) await run(statement);
  })().catch((e) => {
    schemaReady = undefined;
    throw e;
  });
  return schemaReady;
}

/** Every dish name in the menus: what Nutrislice posted plus the hand-added specials and standing menus. */
export function dishNames(data: MenuData): string[] {
  const names = new Set<string>();
  for (const day of Object.values(data.dates))
    for (const meals of Object.values(day))
      for (const stations of Object.values(meals))
        for (const items of Object.values(stations))
          for (const item of items) if (item.name.trim()) names.add(item.name.trim());
  return [...names];
}

/** Saves the names of any dishes not seen before. */
export async function recordDishes(names: string[]) {
  if (!names.length) return;
  await ensureSchema();
  await run("INSERT INTO dishes (name) SELECT DISTINCT unnest($1::text[]) ON CONFLICT (name) DO NOTHING", [names]);
}

export type Vote = 1 | -1 | 0;

/** Every dish with a vote or a review: its thumbs ups, thumbs downs and review count. For a signed-in person, also their own vote on each dish. */
export async function getLikeState(userId: string | undefined) {
  await ensureSchema();
  const [votes, reviews, mine] = await Promise.all([
    run("SELECT name, thumbs_up, thumbs_down, score FROM dishes WHERE thumbs_up > 0 OR thumbs_down > 0"),
    run(`SELECT dish, count(*) AS n FROM dish_reviews r WHERE ${REPORT_COUNT} < ${REPORTS_TO_HIDE} GROUP BY dish`),
    userId ? run("SELECT dish, value FROM dish_likes WHERE user_id = $1", [userId]) : Promise.resolve([]),
  ]);
  const counts: Record<string, { up: number; down: number; score: number; reviews: number }> = {};
  for (const r of votes)
    counts[r.name as string] = { up: Number(r.thumbs_up), down: Number(r.thumbs_down), score: Number(r.score), reviews: 0 };
  for (const r of reviews) (counts[r.dish as string] ??= { up: 0, down: 0, score: 0, reviews: 0 }).reviews = Number(r.n);
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
  ]);
  if (!results[0].length) return null;
  return { up: Number(results[2][0].thumbs_up), down: Number(results[2][0].thumbs_down), vote: Number(results[3][0].vote) };
}

export type Review = { id: number; name: string; body: string; createdAt: string; mine: boolean; reported: boolean };

/** A dish's reviews, newest first. Reviews with enough reports are left out, except for the person who wrote them. */
export async function getReviews(dish: string, userId: string | undefined): Promise<Review[]> {
  await ensureSchema();
  const rows = await run(
    `SELECT r.id, r.user_id, r.user_name, r.body, r.created_at,
            EXISTS (SELECT 1 FROM review_reports x WHERE x.review_id = r.id AND x.reporter_id = $2) AS reported
     FROM dish_reviews r
     WHERE r.dish = $1 AND (r.user_id = $2 OR ${REPORT_COUNT} < ${REPORTS_TO_HIDE})
     ORDER BY r.created_at DESC LIMIT 100`,
    [dish, userId ?? ""],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    // First word only, so reviews saved before the last initial was dropped show the same way.
    name: (r.user_name as string).split(" ")[0],
    body: r.body as string,
    createdAt: new Date(r.created_at as string).toISOString(),
    mine: !!userId && r.user_id === userId,
    reported: r.reported === true,
  }));
}

/** One review per person per dish: writing again replaces it. False when the dish isn't one HamEats has shown. */
export async function saveReview(dish: string, userId: string, userName: string, body: string) {
  await ensureSchema();
  const rows = await run(
    `INSERT INTO dish_reviews (dish, user_id, user_name, body)
     SELECT name, $2, $3, $4 FROM dishes WHERE name = $1
     ON CONFLICT (dish, user_id) DO UPDATE SET body = EXCLUDED.body, user_name = EXCLUDED.user_name, updated_at = now()
     RETURNING 1 AS saved`,
    [dish, userId, userName, body],
  );
  return rows.length > 0;
}

export async function deleteReview(dish: string, userId: string) {
  await ensureSchema();
  await run("DELETE FROM dish_reviews WHERE dish = $1 AND user_id = $2", [dish, userId]);
}

export const REPORT_REASONS = [
  "Offensive or hateful",
  "Harassment or targets someone",
  "Spam",
  "Not about this food",
  "Something else",
] as const;

export type ReportResult =
  | { status: "missing" }
  | { status: "own" }
  | { status: "duplicate" }
  | { status: "reported"; count: number; dish: string; body: string; author: string };

/** Records that `reporterId` reported a review. Nobody can report their own review or report one twice. */
export async function reportReview(reviewId: number, reporterId: string, reason: string): Promise<ReportResult> {
  await ensureSchema();
  const found = await run("SELECT dish, user_id, user_name, body FROM dish_reviews WHERE id = $1", [reviewId]);
  if (!found.length) return { status: "missing" };
  const review = found[0];
  if (review.user_id === reporterId) return { status: "own" };
  const inserted = await run(
    "INSERT INTO review_reports (review_id, reporter_id, reason) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1 AS ok",
    [reviewId, reporterId, reason || null],
  );
  if (!inserted.length) return { status: "duplicate" };
  const [{ n }] = await run("SELECT count(*) AS n FROM review_reports WHERE review_id = $1", [reviewId]);
  return {
    status: "reported",
    count: Number(n),
    dish: review.dish as string,
    body: review.body as string,
    author: (review.user_name as string).split(" ")[0],
  };
}
