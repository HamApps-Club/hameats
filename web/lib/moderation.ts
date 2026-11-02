import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { run } from "@/lib/db";
import { ensureSchema } from "@/lib/dishes";
import { removePhotos } from "@/lib/photos";
import { SITE_URL } from "@/lib/site";

// Everything students write (posts, photos, reviews and comments) is sent to the same Discord channel as reports
// (REPORT_WEBHOOK_URL), so the site's owner can look it over. Each message carries a private link that removes it.
// The link is signed with a secret, so only someone who has the Discord message can use it.

export type Target = "post" | "comment";

/** What signs removal links. MODERATION_SECRET if set, else the login secret the site already has. */
const secret = () => process.env.MODERATION_SECRET || process.env.AUTH_SECRET;

function sign(target: Target, id: number) {
  const key = secret();
  return key ? createHmac("sha256", key).update(`remove-${target}:${id}`).digest("hex") : null;
}

/** Whether `sig` is the signature for removing this post or comment. */
export function validRemoval(target: Target, id: number, sig: string | null) {
  const expected = sign(target, id);
  if (!expected || !sig || sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function removalUrl(target: Target, id: number) {
  const sig = sign(target, id);
  return sig ? `${SITE_URL}/api/mod/remove?type=${target}&id=${id}&sig=${sig}` : null;
}

export type ForReview = {
  target: Target;
  id: number;
  /** "Review of Chicken Tenders", "Photo post", "Comment on a post" and the like. */
  what: string;
  hall: string | null;
  body: string;
  author: string;
  edited: boolean;
  photoUrl: string | null;
  /** For a comment, what the post it's on says (so it can be read in context). */
  onPost: string | null;
};

/** A post or comment as the owner needs to see it, whoever wrote it and whether or not reports have hidden it. */
export async function getForReview(target: Target, id: number): Promise<ForReview | null> {
  await ensureSchema();
  if (target === "comment") {
    const rows = await run(
      `SELECT c.id, c.body, COALESCE(pr.username, 'student') AS author, p.kind, p.dish, p.hall,
              CASE WHEN p.body <> '' THEN p.body ELSE '(photo only)' END AS on_post
       FROM comments c JOIN posts p ON p.id = c.post_id LEFT JOIN profiles pr ON pr.user_id = c.user_id WHERE c.id = $1`,
      [id],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      target,
      id,
      what: r.kind === "review" ? `Comment on a review of ${r.dish}` : "Comment on a post",
      hall: (r.hall as string) ?? null,
      body: r.body as string,
      author: r.author as string,
      edited: false,
      photoUrl: null,
      onPost: r.on_post as string,
    };
  }
  const rows = await run(
    `SELECT p.id, p.kind, p.dish, p.hall, p.body, p.updated_at > p.created_at AS edited,
            COALESCE(pr.username, 'student') AS author,
            (SELECT ph.url FROM photos ph WHERE ph.post_id = p.id ORDER BY ph.position, ph.id LIMIT 1) AS photo_url
     FROM posts p LEFT JOIN profiles pr ON pr.user_id = p.user_id WHERE p.id = $1`,
    [id],
  );
  if (!rows.length) return null;
  const r = rows[0];
  const photoUrl = (r.photo_url as string) ?? null;
  return {
    target,
    id,
    what: r.kind === "review" ? `Review of ${r.dish}` : photoUrl ? "Photo post" : "Post",
    hall: (r.hall as string) ?? null,
    body: r.body as string,
    author: r.author as string,
    edited: !!r.edited,
    photoUrl,
    onPost: null,
  };
}

/**
 * Sends a new post, review or comment to the Discord channel. Never throws and never waits long: it's saved either
 * way. Meant to be called from `after()`, so the person writing isn't kept waiting.
 */
export async function sendForReview(target: Target, id: number) {
  const url = process.env.REPORT_WEBHOOK_URL;
  if (!url) {
    console.warn("REPORT_WEBHOOK_URL is not set; new post not sent to Discord");
    return;
  }
  try {
    const item = await getForReview(target, id);
    if (!item) return;
    const remove = removalUrl(target, id);
    const fields = [
      { name: "By", value: `u/${item.author}`, inline: true },
      ...(item.hall ? [{ name: "Hall", value: item.hall, inline: true }] : []),
      ...(item.onPost ? [{ name: "On", value: item.onPost.slice(0, 300) }] : []),
      { name: "Remove", value: remove ? `[Remove this ${target}](${remove})` : "Set MODERATION_SECRET or AUTH_SECRET to get a removal link." },
    ];
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Students write these, so they must never be able to ping anyone (@everyone and the like).
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: `${item.edited ? "Edited" : "New"}: ${item.what}`.slice(0, 256),
            description: (item.body || "(no text)").slice(0, 4000),
            color: target === "comment" ? 0x95a5a6 : item.photoUrl ? 0xe67e22 : 0x3498db,
            fields,
            ...(item.photoUrl ? { image: { url: item.photoUrl } } : {}),
            footer: { text: `${target === "comment" ? "Comment" : "Post"} id ${id}` },
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

/**
 * Tells the owner the AI removed a photo post: what it was and whose it was (not why). The photo is attached to the
 * message itself, since its file is deleted from the site. Never throws.
 */
export async function sendAiRemoval(item: { what: string; author: string; hall: string | null; body: string; image: ArrayBuffer | null }) {
  const url = process.env.REPORT_WEBHOOK_URL;
  if (!url) {
    console.warn("REPORT_WEBHOOK_URL is not set; AI removal notice not sent");
    return;
  }
  try {
    const payload = {
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: `🤖 The AI removed this: ${item.what}`.slice(0, 256),
          description: (item.body || "(no text)").slice(0, 4000),
          color: 0xc0392b,
          fields: [
            { name: "Posted by", value: `u/${item.author}`, inline: true },
            ...(item.hall ? [{ name: "Hall", value: item.hall, inline: true }] : []),
          ],
          ...(item.image ? { image: { url: "attachment://photo.jpg" } } : {}),
          timestamp: new Date().toISOString(),
        },
      ],
    };
    const form = new FormData();
    form.append("payload_json", JSON.stringify(payload));
    if (item.image) form.append("files[0]", new Blob([item.image], { type: "image/jpeg" }), "photo.jpg");
    const res = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(8000) });
    if (!res.ok) console.error("AI removal notice failed:", res.status);
  } catch (e) {
    console.error("AI removal notice failed:", e);
  }
}

/**
 * Removes any post or review (with its comments, votes and photo files) or any comment (with its replies and votes).
 * False when it was already gone.
 */
export async function removeAsOwner(target: Target, id: number) {
  await ensureSchema();
  if (target === "comment") return (await run("DELETE FROM comments WHERE id = $1 RETURNING id", [id])).length > 0;
  const photos = await run("SELECT storage_key FROM photos WHERE post_id = $1", [id]);
  const rows = await run("DELETE FROM posts WHERE id = $1 RETURNING id", [id]);
  await removePhotos(photos.map((p) => p.storage_key as string));
  return rows.length > 0;
}
