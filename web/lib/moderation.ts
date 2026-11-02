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

/** What signs the links. MODERATION_SECRET if set, else the login secret the site already has. */
const secret = () => process.env.MODERATION_SECRET || process.env.AUTH_SECRET;

/** Remove deletes a post or comment for good; restore brings back a post the AI photo check hid. */
export type LinkAction = "remove" | "restore";

function sign(action: LinkAction, target: Target, id: number) {
  const key = secret();
  return key ? createHmac("sha256", key).update(`${action}-${target}:${id}`).digest("hex") : null;
}

/** Whether `sig` is the signature for this action on this post or comment. */
export function validLink(action: LinkAction, target: Target, id: number, sig: string | null) {
  const expected = sign(action, target, id);
  if (!expected || !sig || sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function linkUrl(action: LinkAction, target: Target, id: number) {
  const sig = sign(action, target, id);
  return sig ? `${SITE_URL}/api/mod/${action}?type=${target}&id=${id}&sig=${sig}` : null;
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
  /** Whether the AI photo check has hidden it. */
  hiddenByAi: boolean;
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
      hiddenByAi: false,
    };
  }
  const rows = await run(
    `SELECT p.id, p.kind, p.dish, p.hall, p.body, p.updated_at > p.created_at AS edited, p.hidden_by_ai_at IS NOT NULL AS hidden,
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
    hiddenByAi: !!r.hidden,
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
    const remove = linkUrl("remove", target, id);
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
 * Tells the owner the AI photo check stopped a photo post: what it was and whose it was (not why). A post that went up
 * and was hidden comes with Restore and Remove links; one refused before it went up comes with its photo attached,
 * since that photo's file is deleted from the site. Never throws.
 */
export async function sendAiNotice(
  item: { what: string; author: string; hall: string | null; body: string },
  outcome: { hiddenPostId: number; photoUrl: string | null } | { refusedImage: ArrayBuffer | null },
) {
  const url = process.env.REPORT_WEBHOOK_URL;
  if (!url) {
    console.warn("REPORT_WEBHOOK_URL is not set; AI photo check notice not sent");
    return;
  }
  try {
    const hidden = "hiddenPostId" in outcome ? outcome : null;
    const attached = !hidden && "refusedImage" in outcome ? outcome.refusedImage : null;
    const links = hidden
      ? [linkUrl("restore", "post", hidden.hiddenPostId), linkUrl("remove", "post", hidden.hiddenPostId)]
      : [];
    const payload = {
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: `🤖 The AI ${hidden ? "hid" : "blocked"} this: ${item.what}`.slice(0, 256),
          description: (item.body || "(no text)").slice(0, 4000),
          color: 0xc0392b,
          fields: [
            { name: "Posted by", value: `u/${item.author}`, inline: true },
            ...(item.hall ? [{ name: "Hall", value: item.hall, inline: true }] : []),
            hidden
              ? {
                  name: "What now",
                  value:
                    links[0] && links[1]
                      ? `Hidden from everyone. [Restore it](${links[0]}) if the AI got it wrong, or [remove it for good](${links[1]}).`
                      : "Hidden from everyone. Set MODERATION_SECRET or AUTH_SECRET to get Restore and Remove links.",
                }
              : { name: "What now", value: "It was stopped before it went up, and the student was asked to try a different photo." },
          ],
          ...(hidden?.photoUrl ? { image: { url: hidden.photoUrl } } : attached ? { image: { url: "attachment://photo.jpg" } } : {}),
          timestamp: new Date().toISOString(),
        },
      ],
    };
    const form = new FormData();
    form.append("payload_json", JSON.stringify(payload));
    if (attached) form.append("files[0]", new Blob([attached], { type: "image/jpeg" }), "photo.jpg");
    const res = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(8000) });
    if (!res.ok) console.error("AI photo check notice failed:", res.status);
  } catch (e) {
    console.error("AI photo check notice failed:", e);
  }
}

/** Brings back a post the AI hid; its photo won't be checked again. False when it wasn't hidden (or is gone). */
export async function restorePost(id: number) {
  await ensureSchema();
  const rows = await run("UPDATE posts SET hidden_by_ai_at = NULL WHERE id = $1 AND hidden_by_ai_at IS NOT NULL RETURNING id", [id]);
  await run("UPDATE photos SET ai_verdict = 'restored' WHERE post_id = $1", [id]);
  return rows.length > 0;
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
