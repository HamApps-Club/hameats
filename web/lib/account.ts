import "server-only";
import { run, transaction, type Row } from "@/lib/db";
import { ensureSchema } from "@/lib/dishes";
import { removePhotos } from "@/lib/photos";

// A person's whole account: everything HamEats keeps about them, to download (Profile, Download my data) or to delete
// (Profile, Delete account). Every table with a user_id column in lib/dishes.ts is covered here; a new one needs adding
// to both. The old Feed's tables (posts, comments, photos, votes, profiles) are covered too, wherever they still exist.

/** Postgres' "undefined_table": an old table this database never had. */
const missingTable = (e: unknown) => (e as { code?: string }).code === "42P01";

/** A query on one of the old Feed's tables: no rows when the table doesn't exist. */
const legacy = (text: string, params: unknown[]): Promise<Row[]> =>
  run(text, params).catch((e) => {
    if (missingTable(e)) return [];
    throw e;
  });

/** Everything stored about the person, as one JSON-ready object. */
export async function exportAccount(userId: string) {
  await ensureSchema();
  const q = (text: string) => run(text, [userId]);
  const old = (text: string) => legacy(text, [userId]);
  const [favorites, prefs, mutes, devices, notifications, posts, comments, photos, dishVotes] = await Promise.all([
    q("SELECT dish, created_at AS saved_at FROM favorites WHERE user_id = $1 ORDER BY created_at"),
    q("SELECT alerts, email, push, updated_at FROM notification_prefs WHERE user_id = $1"),
    q("SELECT dish FROM alert_mutes WHERE user_id = $1 ORDER BY dish"),
    q("SELECT created_at FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at"),
    q("SELECT kind, served_on, title, body, items, created_at, read_at FROM notifications WHERE user_id = $1 ORDER BY created_at"),
    old("SELECT id, kind, dish, hall, body, created_at FROM posts WHERE user_id = $1 ORDER BY created_at"),
    old("SELECT id, post_id, body, created_at FROM comments WHERE user_id = $1 ORDER BY created_at"),
    old("SELECT id, post_id, url, created_at FROM photos WHERE user_id = $1 ORDER BY created_at"),
    old("SELECT dish, value, created_at FROM dish_likes WHERE user_id = $1 ORDER BY dish"),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    email: userId,
    favorites,
    alertSettings: prefs[0] ?? null,
    alertsSwitchedOff: mutes.map((m) => m.dish),
    pushDevices: devices.length,
    notifications,
    ...(posts.length || comments.length || photos.length || dishVotes.length
      ? { fromTheOldFeed: { postsAndReviews: posts, comments, photos, dishVotes } }
      : {}),
  };
}

/** Rows in the old Feed's tables that belong to the person. Each runs on its own, since any of the tables may be missing. */
const LEGACY_DELETES = [
  "DELETE FROM posts WHERE user_id = $1", // cascades to the comments, votes, reports and photos on their posts
  "DELETE FROM comments WHERE user_id = $1",
  "DELETE FROM photos WHERE user_id = $1",
  "DELETE FROM post_votes WHERE user_id = $1",
  "DELETE FROM comment_votes WHERE user_id = $1",
  "DELETE FROM dish_likes WHERE user_id = $1",
  "DELETE FROM vote_events WHERE user_id = $1",
  "DELETE FROM dish_reviews WHERE user_id = $1",
  "UPDATE reports SET reporter_id = 'deleted:' || id WHERE reporter_id = $1",
  "DELETE FROM review_reports WHERE reporter_id = $1",
  "DELETE FROM profiles WHERE user_id = $1",
];

/**
 * Deletes the person's account and everything kept about them: favorites, alert settings, push subscriptions, saved
 * notifications, and anything they wrote in the old Feed (with its photo files).
 */
export async function deleteAccount(userId: string) {
  await ensureSchema();
  const u = [userId];
  const photos = await legacy("SELECT storage_key FROM photos WHERE user_id = $1", u);
  for (const statement of LEGACY_DELETES) await legacy(statement, u);
  await transaction([
    ["DELETE FROM favorites WHERE user_id = $1", u],
    ["DELETE FROM notification_prefs WHERE user_id = $1", u],
    ["DELETE FROM alert_mutes WHERE user_id = $1", u],
    ["DELETE FROM push_subscriptions WHERE user_id = $1", u],
    ["DELETE FROM notifications WHERE user_id = $1", u],
    ["DELETE FROM alerts_sent WHERE user_id = $1", u],
  ]);
  await removePhotos(photos.map((p) => p.storage_key as string));
}
