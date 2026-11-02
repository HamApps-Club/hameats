import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { run } from "@/lib/db";
import { ensureSchema } from "@/lib/dishes";
import { removePhotos } from "@/lib/photos";
import { SITE_URL } from "@/lib/site";

// Every new post and review (and every edited review) is sent to a Discord channel so the site's owner can look it
// over. Each message carries a private link that removes the post. The link is signed with a secret, so only someone
// who has the Discord message can use it.

/** The channel for new posts: NEW_POSTS_WEBHOOK_URL, or the reports channel when that isn't set. */
const webhookUrl = () => process.env.NEW_POSTS_WEBHOOK_URL || process.env.REPORT_WEBHOOK_URL;

/** What signs removal links. MODERATION_SECRET if set, else the login secret the site already has. */
const secret = () => process.env.MODERATION_SECRET || process.env.AUTH_SECRET;

function sign(postId: number) {
  const key = secret();
  return key ? createHmac("sha256", key).update(`remove-post:${postId}`).digest("hex") : null;
}

/** Whether `sig` is the signature for removing this post. */
export function validRemoval(postId: number, sig: string | null) {
  const expected = sign(postId);
  if (!expected || !sig || sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export function removalUrl(postId: number) {
  const sig = sign(postId);
  return sig ? `${SITE_URL}/api/mod/remove?id=${postId}&sig=${sig}` : null;
}

export type PostForReview = {
  id: number;
  kind: "review" | "post";
  dish: string | null;
  hall: string | null;
  body: string;
  author: string;
  edited: boolean;
  photoUrl: string | null;
};

/** A post as the owner needs to see it, whoever wrote it and whether or not it has been hidden by reports. */
export async function postForReview(postId: number): Promise<PostForReview | null> {
  await ensureSchema();
  const rows = await run(
    `SELECT p.id, p.kind, p.dish, p.hall, p.body, p.updated_at > p.created_at AS edited,
            COALESCE(pr.username, 'student') AS author,
            (SELECT ph.url FROM photos ph WHERE ph.post_id = p.id ORDER BY ph.position, ph.id LIMIT 1) AS photo_url
     FROM posts p LEFT JOIN profiles pr ON pr.user_id = p.user_id WHERE p.id = $1`,
    [postId],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    kind: r.kind as "review" | "post",
    dish: (r.dish as string) ?? null,
    hall: (r.hall as string) ?? null,
    body: r.body as string,
    author: r.author as string,
    edited: !!r.edited,
    photoUrl: (r.photo_url as string) ?? null,
  };
}

/**
 * Sends a post to the Discord channel. Never throws and never waits long: the post is saved either way. Meant to be
 * called from `after()`, so the person posting isn't kept waiting.
 */
export async function sendForReview(postId: number) {
  const url = webhookUrl();
  if (!url) {
    console.warn("NEW_POSTS_WEBHOOK_URL is not set; new post not sent to Discord");
    return;
  }
  try {
    const post = await postForReview(postId);
    if (!post) return;
    const what = post.kind === "review" ? `review of ${post.dish}` : post.photoUrl ? "photo post" : "post";
    const remove = removalUrl(post.id);
    const fields = [
      { name: "By", value: `u/${post.author}`, inline: true },
      ...(post.hall ? [{ name: "Hall", value: post.hall, inline: true }] : []),
      { name: "Remove", value: remove ? `[Remove this ${post.kind}](${remove})` : "Set MODERATION_SECRET or AUTH_SECRET to get a removal link." },
    ];
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Posts are written by students, so they must never be able to ping anyone (@everyone and the like).
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: `${post.edited ? "Edited" : "New"} ${what}`.slice(0, 256),
            description: (post.body || "(no text)").slice(0, 4000),
            color: post.photoUrl ? 0xe67e22 : 0x3498db,
            fields,
            ...(post.photoUrl ? { image: { url: post.photoUrl } } : {}),
            footer: { text: `Post id ${post.id}` },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.error("new post notice failed:", res.status);
  } catch (e) {
    console.error("new post notice failed:", e);
  }
}

/** Removes any post or review, with its comments, votes and photo files. False when it was already gone. */
export async function removePostAsOwner(postId: number) {
  await ensureSchema();
  const photos = await run("SELECT storage_key FROM photos WHERE post_id = $1", [postId]);
  const rows = await run("DELETE FROM posts WHERE id = $1 RETURNING id", [postId]);
  await removePhotos(photos.map((p) => p.storage_key as string));
  return rows.length > 0;
}
