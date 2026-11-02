import "server-only";
import { run, transaction } from "@/lib/db";
import { ensureSchema } from "@/lib/dishes";
import { removePhotos } from "@/lib/photos";

// A person's whole account: everything HamEats keeps about them, to download (Settings, Download my data) or to delete
// (Settings, Delete account). Every table with a user_id or reporter_id column in lib/dishes.ts is covered here; a new
// one needs adding to both.

/** Everything stored about the person, as one JSON-ready object. */
export async function exportAccount(userId: string) {
  await ensureSchema();
  const q = (text: string) => run(text, [userId]);
  const [profile, posts, comments, photos, dishVotes, postVotes, commentVotes, reports, prefs, mutes, devices] = await Promise.all([
    q("SELECT username, created_at AS joined, username_changed_at, rules_accepted_at FROM profiles WHERE user_id = $1"),
    q(`SELECT id, kind, dish, hall, served_on, meal, body, score, comment_count, created_at, updated_at,
              hidden_by_ai_at IS NOT NULL AS hidden_by_photo_filter
       FROM posts WHERE user_id = $1 ORDER BY created_at`),
    q("SELECT id, post_id, parent_id, body, score, created_at FROM comments WHERE user_id = $1 ORDER BY created_at"),
    q("SELECT id, post_id, url, width, height, created_at FROM photos WHERE user_id = $1 ORDER BY created_at"),
    q("SELECT dish, CASE value WHEN 1 THEN 'thumbs up' ELSE 'thumbs down' END AS vote, created_at FROM dish_likes WHERE user_id = $1 ORDER BY dish"),
    q("SELECT post_id, value, created_at FROM post_votes WHERE user_id = $1 ORDER BY created_at"),
    q("SELECT comment_id, value, created_at FROM comment_votes WHERE user_id = $1 ORDER BY created_at"),
    q("SELECT post_id, comment_id, reason, created_at FROM reports WHERE reporter_id = $1 ORDER BY created_at"),
    q("SELECT alerts, email, push, updated_at FROM notification_prefs WHERE user_id = $1"),
    q("SELECT dish FROM alert_mutes WHERE user_id = $1 ORDER BY dish"),
    q("SELECT created_at FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at"),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    email: userId,
    profile: profile[0] ?? null,
    postsAndReviews: posts,
    comments,
    photos,
    dishVotes,
    postVotes,
    commentVotes,
    reportsYouMade: reports,
    alertSettings: prefs[0] ?? null,
    alertsSwitchedOff: mutes.map((m) => m.dish),
    pushDevices: devices.length,
  };
}

/**
 * Deletes the person's account and everything they added: profile, posts and reviews (with their photos, and the
 * comments and votes on them), comments, votes, alert settings and push subscriptions. Reports they made are kept, so
 * a post hidden by reports doesn't come back, but are no longer linked to them. All in one transaction, then the photo
 * files are removed from storage.
 */
export async function deleteAccount(userId: string) {
  await ensureSchema();
  const [photos, liked] = await Promise.all([
    run("SELECT storage_key FROM photos WHERE user_id = $1", [userId]),
    run("SELECT dish FROM dish_likes WHERE user_id = $1", [userId]),
  ]);
  const dishes = liked.map((l) => l.dish as string);
  const u = [userId];
  await transaction([
    // Cascades to the comments, votes, reports and photos on their posts.
    ["DELETE FROM posts WHERE user_id = $1", u],
    ["DELETE FROM comments WHERE user_id = $1", u],
    ["DELETE FROM photos WHERE user_id = $1", u],
    ["DELETE FROM post_votes WHERE user_id = $1", u],
    ["DELETE FROM comment_votes WHERE user_id = $1", u],
    ["DELETE FROM dish_likes WHERE user_id = $1", u],
    [
      `UPDATE dishes SET
         thumbs_up = (SELECT count(*) FROM dish_likes l WHERE l.dish = dishes.name AND l.value = 1),
         thumbs_down = (SELECT count(*) FROM dish_likes l WHERE l.dish = dishes.name AND l.value = -1)
       WHERE name = ANY($1::text[])`,
      [dishes],
    ],
    ["DELETE FROM vote_events WHERE user_id = $1", u],
    // The first version of reviews (cascades to its reports).
    ["DELETE FROM dish_reviews WHERE user_id = $1", u],
    // Each kept report gets its own meaningless id, so they still count but can't be traced back or to each other.
    ["UPDATE reports SET reporter_id = 'deleted:' || id WHERE reporter_id = $1", u],
    ["UPDATE review_reports SET reporter_id = 'deleted:' || md5(random()::text || review_id::text) WHERE reporter_id = $1", u],
    ["DELETE FROM notification_prefs WHERE user_id = $1", u],
    ["DELETE FROM alert_mutes WHERE user_id = $1", u],
    ["DELETE FROM push_subscriptions WHERE user_id = $1", u],
    ["DELETE FROM profiles WHERE user_id = $1", u],
  ]);
  await removePhotos(photos.map((p) => p.storage_key as string));
}
