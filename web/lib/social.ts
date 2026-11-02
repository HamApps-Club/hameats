import "server-only";
import { run, transaction } from "@/lib/db";
import { POST_VISIBLE, REPORTS_TO_HIDE, ensureProfile, ensureSchema } from "@/lib/dishes";
import { usernameProblem } from "@/lib/usernames";

// The Feed, comments, profiles, alert settings and photos. Tables are described in lib/dishes.ts.
// Nothing here ever returns a person's id (their email): other people only see usernames, plus `mine` flags.

export const MAX_POST = 500;
export const MAX_COMMENT = 500;
/** How much one person can write in a day, so a single account can't flood the Feed. */
const POSTS_PER_DAY = 25;
const COMMENTS_PER_DAY = 100;
const PHOTOS_PER_DAY = 30;

export type Photo = { url: string; width: number; height: number };

export type FeedItem = {
  id: number;
  kind: "review" | "post";
  author: string;
  mine: boolean;
  /** Hall slug: the flair. */
  hall: string | null;
  /** Reviews only. */
  dish: string | null;
  /** Reviews only: the author's thumbs on the dish (1, -1, or 0). */
  verdict: number;
  /** Reviews only: how many reviews the dish has. */
  dishReviews: number;
  body: string;
  photo: Photo | null;
  createdAt: string;
  score: number;
  myVote: number;
  comments: number;
  reported: boolean;
};

/** SQL for posts as FeedItems. $1 is the person looking ('' when logged out). */
const POST_COLUMNS = `
  p.id, p.kind, p.user_id = $1 AS mine, COALESCE(pr.username, 'student') AS author, p.hall, p.dish, p.body,
  p.created_at, p.score, p.comment_count,
  CASE WHEN p.kind = 'review'
    THEN COALESCE((SELECT value FROM dish_likes l WHERE l.dish = p.dish AND l.user_id = p.user_id), 0) ELSE 0 END AS verdict,
  CASE WHEN p.kind = 'review'
    THEN (SELECT count(*) FROM posts q WHERE q.kind = 'review' AND q.dish = p.dish
          AND (SELECT count(*) FROM reports x WHERE x.post_id = q.id) < ${REPORTS_TO_HIDE}) ELSE 0 END AS dish_reviews,
  COALESCE((SELECT value FROM post_votes v WHERE v.post_id = p.id AND v.user_id = $1), 0) AS my_vote,
  EXISTS (SELECT 1 FROM reports x WHERE x.post_id = p.id AND x.reporter_id = $1) AS reported,
  (SELECT json_build_object('url', ph.url, 'width', ph.width, 'height', ph.height)
     FROM photos ph WHERE ph.post_id = p.id ORDER BY ph.position, ph.id LIMIT 1) AS photo`;

const POST_FROM = "FROM posts p LEFT JOIN profiles pr ON pr.user_id = p.user_id";

const iso = (v: unknown) => new Date(v as string).toISOString();
const parseJson = <T,>(v: unknown): T | null => (v == null ? null : typeof v === "string" ? (JSON.parse(v) as T) : (v as T));

function toFeedItem(r: Record<string, unknown>): FeedItem {
  return {
    id: Number(r.id),
    kind: r.kind as "review" | "post",
    author: r.author as string,
    mine: r.mine === true,
    hall: (r.hall as string | null) ?? null,
    dish: (r.dish as string | null) ?? null,
    verdict: Number(r.verdict),
    dishReviews: Number(r.dish_reviews),
    body: r.body as string,
    photo: parseJson<Photo>(r.photo),
    createdAt: iso(r.created_at),
    score: Number(r.score),
    myVote: Number(r.my_vote),
    comments: Number(r.comment_count),
    reported: r.reported === true,
  };
}

/** A page cursor: the last item's time and id, so the next page starts exactly after it. */
export const encodeCursor = (item: FeedItem) => `${item.createdAt}_${item.id}`;
export function decodeCursor(cursor: string | null): { at: string; id: number } | null {
  const m = cursor?.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)_(\d+)$/);
  return m ? { at: m[1], id: Number(m[2]) } : null;
}

export const FEED_PAGE = 20;

export type FeedKind = "all" | "review" | "post";

/** The Feed, newest first, one page at a time: everything, or only reviews, or only posts. */
export async function getFeed(viewerId: string | undefined, cursor: { at: string; id: number } | null, kind: FeedKind = "all") {
  await ensureSchema();
  const params: unknown[] = [viewerId ?? ""];
  let after = "";
  if (cursor) {
    params.push(cursor.at, cursor.id);
    after = "AND (p.created_at, p.id) < ($2::timestamptz, $3::bigint)";
  }
  // kind is one of two fixed words, never text from the request, so it can go straight into the query.
  const only = kind === "all" ? "" : `AND p.kind = '${kind}'`;
  const rows = await run(
    `SELECT ${POST_COLUMNS} ${POST_FROM} WHERE ${POST_VISIBLE} ${after} ${only}
     ORDER BY p.created_at DESC, p.id DESC LIMIT ${FEED_PAGE + 1}`,
    params,
  );
  const items = rows.slice(0, FEED_PAGE).map(toFeedItem);
  return { items, next: rows.length > FEED_PAGE ? encodeCursor(items[items.length - 1]) : null };
}

export async function getPost(viewerId: string | undefined, id: number): Promise<FeedItem | null> {
  await ensureSchema();
  const rows = await run(`SELECT ${POST_COLUMNS} ${POST_FROM} WHERE p.id = $2 AND ${POST_VISIBLE}`, [viewerId ?? "", id]);
  return rows.length ? toFeedItem(rows[0]) : null;
}

async function writtenToday(table: "posts" | "comments" | "photos", userId: string, kind?: "post") {
  const rows = await run(
    `SELECT count(*) AS n FROM ${table} WHERE user_id = $1 AND created_at > now() - interval '1 day'${kind ? " AND kind = 'post'" : ""}`,
    [userId],
  );
  return Number(rows[0].n);
}

export type CreatePostResult = { ok: true; id: number } | { ok: false; error: "too many" | "bad photo" | "photo removed" };

/** A post (not a review): words, a photo, or both, with an optional dining hall flair. */
export async function createPost(userId: string, body: string, hall: string | null, photoId: number | null): Promise<CreatePostResult> {
  await ensureSchema();
  await ensureProfile(userId);
  if ((await writtenToday("posts", userId, "post")) >= POSTS_PER_DAY) return { ok: false, error: "too many" };
  if (photoId !== null) {
    const photo = await run("SELECT ai_verdict FROM photos WHERE id = $1 AND user_id = $2 AND post_id IS NULL", [photoId, userId]);
    if (!photo.length) return { ok: false, error: "bad photo" };
    // The AI photo check (lib/photoCheck.ts) already turned this photo down.
    if (photo[0].ai_verdict === "rejected") return { ok: false, error: "photo removed" };
  }
  const [inserted] = await transaction([
    ["INSERT INTO posts (kind, user_id, hall, body) VALUES ('post', $1, $2, $3) RETURNING id", [userId, hall, body]],
  ]);
  const id = Number(inserted[0].id);
  if (photoId !== null) await run("UPDATE photos SET post_id = $1 WHERE id = $2 AND user_id = $3 AND post_id IS NULL", [id, photoId, userId]);
  return { ok: true, id };
}

/** Deletes one of the person's own posts or reviews, with its comments and votes. Returns the photos' storage keys to remove. */
export async function deletePost(userId: string, id: number): Promise<{ deleted: boolean; photoKeys: string[] }> {
  await ensureSchema();
  const photos = await run("SELECT ph.storage_key FROM photos ph JOIN posts p ON p.id = ph.post_id WHERE p.id = $1 AND p.user_id = $2", [id, userId]);
  const rows = await run("DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
  return { deleted: rows.length > 0, photoKeys: photos.map((p) => p.storage_key as string) };
}

/** Up, down, or 0 to take the vote back, on a post or a comment. Null when it doesn't exist (or is hidden). */
export async function castVote(target: "post" | "comment", userId: string, id: number, value: 1 | -1 | 0) {
  await ensureSchema();
  const [table, votes, key] = target === "post" ? ["posts", "post_votes", "post_id"] : ["comments", "comment_votes", "comment_id"];
  const exists = await run(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  if (!exists.length) return null;
  const results = await transaction([
    value === 0
      ? [`DELETE FROM ${votes} WHERE ${key} = $1 AND user_id = $2`, [id, userId]]
      : [
          `INSERT INTO ${votes} (${key}, user_id, value) VALUES ($1, $2, $3)
           ON CONFLICT (${key}, user_id) DO UPDATE SET value = EXCLUDED.value, created_at = now()`,
          [id, userId, value],
        ],
    [`SELECT score FROM ${table} WHERE id = $1`, [id]],
  ]);
  return { score: Number(results[1][0]?.score ?? 0), myVote: value };
}

export type CommentItem = {
  id: number;
  author: string;
  mine: boolean;
  body: string;
  createdAt: string;
  score: number;
  myVote: number;
  reported: boolean;
};

/** A post's comments: highest score first, then oldest first. Reported-away comments are left out, except for their author. */
export async function getComments(viewerId: string | undefined, postId: number): Promise<CommentItem[]> {
  await ensureSchema();
  const rows = await run(
    `SELECT c.id, c.user_id = $1 AS mine, COALESCE(pr.username, 'student') AS author, c.body, c.created_at, c.score,
            COALESCE((SELECT value FROM comment_votes v WHERE v.comment_id = c.id AND v.user_id = $1), 0) AS my_vote,
            EXISTS (SELECT 1 FROM reports x WHERE x.comment_id = c.id AND x.reporter_id = $1) AS reported
     FROM comments c LEFT JOIN profiles pr ON pr.user_id = c.user_id
     WHERE c.post_id = $2 AND (c.user_id = $1 OR (SELECT count(*) FROM reports x WHERE x.comment_id = c.id) < ${REPORTS_TO_HIDE})
     ORDER BY c.score DESC, c.created_at ASC, c.id ASC LIMIT 300`,
    [viewerId ?? "", postId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    author: r.author as string,
    mine: r.mine === true,
    body: r.body as string,
    createdAt: iso(r.created_at),
    score: Number(r.score),
    myVote: Number(r.my_vote),
    reported: r.reported === true,
  }));
}

export async function addComment(userId: string, postId: number, body: string): Promise<{ ok: true; id: number } | { ok: false; error: "missing" | "too many" }> {
  await ensureSchema();
  await ensureProfile(userId);
  if ((await writtenToday("comments", userId)) >= COMMENTS_PER_DAY) return { ok: false, error: "too many" };
  const rows = await run(
    `INSERT INTO comments (post_id, user_id, body) SELECT p.id, $2, $3 FROM posts p WHERE p.id = $1 AND ${POST_VISIBLE.replaceAll("$1", "$2")}
     RETURNING id`,
    [postId, userId, body],
  );
  return rows.length ? { ok: true, id: Number(rows[0].id) } : { ok: false, error: "missing" };
}

export async function deleteComment(userId: string, id: number) {
  await ensureSchema();
  const rows = await run("DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
  return rows.length > 0;
}

// ---- Profiles

export type Me = { username: string; joined: string; unread: boolean };

/** The signed-in person's own profile (created on first use), and whether anyone has commented on or voted on their posts since they last opened the Feed. */
export async function getMe(userId: string): Promise<Me> {
  await ensureSchema();
  await ensureProfile(userId);
  const rows = await run(
    `SELECT pr.username, pr.created_at,
       EXISTS (SELECT 1 FROM comments c JOIN posts p ON p.id = c.post_id
               WHERE p.user_id = $1 AND c.user_id <> $1 AND c.created_at > pr.feed_seen_at)
       OR EXISTS (SELECT 1 FROM post_votes v JOIN posts p ON p.id = v.post_id
               WHERE p.user_id = $1 AND v.user_id <> $1 AND v.value = 1 AND v.created_at > pr.feed_seen_at) AS unread
     FROM profiles pr WHERE pr.user_id = $1`,
    [userId],
  );
  return { username: rows[0].username as string, joined: iso(rows[0].created_at), unread: rows[0].unread === true };
}

export async function markFeedSeen(userId: string) {
  await ensureSchema();
  await run("UPDATE profiles SET feed_seen_at = now() WHERE user_id = $1", [userId]);
}

/** Why `name` can't be someone's new username, or null when it's free. */
export async function usernameUnavailable(name: string, userId: string | undefined): Promise<string | null> {
  const problem = usernameProblem(name);
  if (problem) return problem;
  await ensureSchema();
  const rows = await run("SELECT user_id = $2 AS mine FROM profiles WHERE lower(username) = lower($1)", [name, userId ?? ""]);
  if (!rows.length) return null;
  return rows[0].mine === true ? "That's already your username." : "That username is taken.";
}

/** Changes the person's username. The unique index has the last word, so two people choosing one name at once can't both get it. */
export async function renameUser(userId: string, name: string): Promise<string | null> {
  const problem = await usernameUnavailable(name, userId);
  if (problem && problem !== "That's already your username.") return problem;
  await ensureProfile(userId);
  try {
    await run("UPDATE profiles SET username = $2, username_changed_at = now() WHERE user_id = $1", [userId, name]);
    return null;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return "That username is taken.";
    throw e;
  }
}

export type ProfileComment = { id: number; postId: number; on: string; snippet: string; body: string; createdAt: string };

export type PublicProfile = {
  username: string;
  joined: string;
  mine: boolean;
  posts: FeedItem[];
  comments: ProfileComment[];
  liked: string[];
  /** Only on your own profile: other people's dislikes stay private. */
  disliked: string[] | null;
};

/** What anyone can see on a student's profile. Null when there's no such username. */
export async function getProfile(username: string, viewerId: string | undefined): Promise<PublicProfile | null> {
  await ensureSchema();
  const found = await run("SELECT user_id, username, created_at FROM profiles WHERE lower(username) = lower($1)", [username]);
  if (!found.length) return null;
  const ownerId = found[0].user_id as string;
  const mine = !!viewerId && viewerId === ownerId;
  const [posts, comments, likes] = await Promise.all([
    run(`SELECT ${POST_COLUMNS} ${POST_FROM} WHERE p.user_id = $2 AND ${POST_VISIBLE} ORDER BY p.created_at DESC, p.id DESC LIMIT 100`, [
      viewerId ?? "",
      ownerId,
    ]),
    run(
      `SELECT c.id, c.post_id, c.body, c.created_at, COALESCE(pr.username, 'student') AS on_user,
              CASE WHEN p.body <> '' THEN p.body WHEN p.kind = 'review' THEN 'Review of ' || p.dish ELSE 'A photo post' END AS snippet
       FROM comments c JOIN posts p ON p.id = c.post_id LEFT JOIN profiles pr ON pr.user_id = p.user_id
       WHERE c.user_id = $2 AND (c.user_id = $1 OR (SELECT count(*) FROM reports x WHERE x.comment_id = c.id) < ${REPORTS_TO_HIDE})
       ORDER BY c.created_at DESC LIMIT 100`,
      [viewerId ?? "", ownerId],
    ),
    run("SELECT dish, value FROM dish_likes WHERE user_id = $1 ORDER BY dish", [ownerId]),
  ]);
  const snippet = (s: string) => (s.length > 80 ? `${s.slice(0, 77)}...` : s);
  return {
    username: found[0].username as string,
    joined: iso(found[0].created_at),
    mine,
    posts: posts.map(toFeedItem),
    comments: comments.map((c) => ({
      id: Number(c.id),
      postId: Number(c.post_id),
      on: c.on_user as string,
      snippet: snippet(c.snippet as string),
      body: c.body as string,
      createdAt: iso(c.created_at),
    })),
    liked: likes.filter((l) => Number(l.value) === 1).map((l) => l.dish as string),
    disliked: mine ? likes.filter((l) => Number(l.value) === -1).map((l) => l.dish as string) : null,
  };
}

// ---- Alert settings

export type AlertDish = { name: string; halls: string[]; dinerOnly: boolean };
export type Settings = { alerts: boolean; email: boolean; push: boolean; muted: string[]; dishes: AlertDish[]; devices: number };

/** The person's alert choices, and the liked dishes they can choose from (with the halls each has been served at). */
export async function getSettings(userId: string): Promise<Settings> {
  await ensureSchema();
  const [prefs, muted, dishes, devices] = await Promise.all([
    run("SELECT alerts, email, push FROM notification_prefs WHERE user_id = $1", [userId]),
    run("SELECT dish FROM alert_mutes WHERE user_id = $1", [userId]),
    run(
      `SELECT l.dish, COALESCE(array_agg(DISTINCT s.hall) FILTER (WHERE s.hall IS NOT NULL), '{}') AS halls
       FROM dish_likes l LEFT JOIN dish_servings s ON s.dish = l.dish
       WHERE l.user_id = $1 AND l.value = 1 GROUP BY l.dish ORDER BY l.dish`,
      [userId],
    ),
    run("SELECT count(*) AS n FROM push_subscriptions WHERE user_id = $1", [userId]),
  ]);
  const p = prefs[0];
  const halls = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : String(v).replace(/^\{|\}$/g, "").split(",").filter(Boolean));
  return {
    alerts: p ? p.alerts === true : false,
    email: p ? p.email === true : true,
    push: p ? p.push === true : false,
    muted: muted.map((m) => m.dish as string),
    dishes: dishes.map((d) => {
      const h = halls(d.halls);
      return { name: d.dish as string, halls: h, dinerOnly: h.length > 0 && h.every((x) => x === "diner") };
    }),
    devices: Number(devices[0].n),
  };
}

export async function saveSettings(userId: string, s: { alerts: boolean; email: boolean; push: boolean; muted: string[] }) {
  await ensureSchema();
  await transaction([
    [
      `INSERT INTO notification_prefs (user_id, alerts, email, push) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET alerts = EXCLUDED.alerts, email = EXCLUDED.email, push = EXCLUDED.push, updated_at = now()`,
      [userId, s.alerts, s.email, s.push],
    ],
    ["DELETE FROM alert_mutes WHERE user_id = $1", [userId]],
    ["INSERT INTO alert_mutes (user_id, dish) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING", [userId, s.muted]],
  ]);
}

export async function savePushSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string }) {
  await ensureSchema();
  await run(
    `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [sub.endpoint, userId, sub.p256dh, sub.auth],
  );
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  await ensureSchema();
  await run("DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2", [endpoint, userId]);
}

// ---- Photos

export async function photosToday(userId: string) {
  await ensureSchema();
  return writtenToday("photos", userId);
}
export const PHOTO_DAILY_LIMIT = PHOTOS_PER_DAY;

export async function recordPhoto(userId: string, p: { url: string; key: string; width: number; height: number; bytes: number }) {
  await ensureSchema();
  const rows = await run(
    "INSERT INTO photos (user_id, url, storage_key, width, height, bytes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    [userId, p.url, p.key, p.width, p.height, p.bytes],
  );
  return Number(rows[0].id);
}
