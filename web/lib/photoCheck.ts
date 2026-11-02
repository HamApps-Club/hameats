import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { run } from "@/lib/db";
import { ensureProfile } from "@/lib/dishes";
import { removePhotos } from "@/lib/photos";
import { getForReview, sendAiNotice } from "@/lib/moderation";

// Every photo is looked over by Claude Haiku as soon as it's uploaded, usually while the student is still typing their
// caption. A photo that breaks the rules below is never shown: if the post isn't up yet it's refused, and if it already
// went up the post is hidden from everyone (not deleted). Either way the owner gets a Discord message saying what the
// AI stopped and whose it was; a hidden post's message has a Restore link in case the AI got it wrong.
// Switched on by ANTHROPIC_API_KEY (from console.anthropic.com, set in Vercel); without it, photos aren't checked.

/** What a photo has to be. Edit this to change what the AI allows. */
const PHOTO_RULES = `You check photos that Hamilton College students attach to posts in HamEats, a dining hall app.

ALLOW the photo if it shows food or drink, or a dining hall, its menu, its line, or a tray, plate or table of food.
People in the photo are fine as long as food or the dining hall is clearly what the photo is about. Unusual-looking,
messy, half-eaten or unappetizing food is still food: allow it.

REMOVE the photo if any of these is true:
- it has nothing to do with food, drink or dining (a selfie, a pet, a room, scenery, a meme, a screenshot of something else)
- nudity or sexual content
- violence, gore, weapons or self-harm
- hateful symbols, slurs or harassing text
- drugs or drug use
- it shows someone's private information (an ID card, a phone number, a document)

When unsure whether it's food related, allow it.`;

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    allowed: { type: "boolean" },
    reason: { type: "string", description: "A few words on why." },
  },
  required: ["allowed", "reason"],
  additionalProperties: false,
} as const;

let anthropic: Anthropic | undefined;
const client = () => (anthropic ??= new Anthropic({ timeout: 30_000, maxRetries: 1 }));

export const photoCheckEnabled = () => !!process.env.ANTHROPIC_API_KEY;

/** Asks Claude Haiku whether the photo at `url` follows the rules. Throws when there's no clear answer. */
async function askClaude(url: string): Promise<{ allowed: boolean; reason: string }> {
  const response = await client().messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 2048,
    system: PHOTO_RULES,
    output_config: { effort: "low", format: { type: "json_schema", schema: VERDICT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url } },
          { type: "text", text: "Should this photo be allowed?" },
        ],
      },
    ],
  });
  // Claude declining to look at a photo at all is a sign it's one that shouldn't be up.
  if (response.stop_reason === "refusal") return { allowed: false, reason: "the model refused to review it" };
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error(`no verdict (stop reason ${response.stop_reason})`);
  const verdict = JSON.parse(text.text) as { allowed: unknown; reason: unknown };
  if (typeof verdict.allowed !== "boolean") throw new Error("verdict without an answer");
  return { allowed: verdict.allowed, reason: String(verdict.reason ?? "") };
}

/**
 * Checks a just-uploaded photo and records the verdict. Never throws: a photo that can't be checked (no key, the API
 * is down) is left unchecked and stays up. Meant to be called from `after()`.
 */
export async function checkPhoto(photoId: number) {
  if (!photoCheckEnabled()) return;
  try {
    const rows = await run("SELECT url FROM photos WHERE id = $1 AND ai_verdict IS NULL", [photoId]);
    if (!rows.length) return;
    const verdict = await askClaude(rows[0].url as string);
    await run("UPDATE photos SET ai_verdict = $2 WHERE id = $1", [photoId, verdict.allowed ? "allowed" : "rejected"]);
    if (!verdict.allowed) {
      // The reason isn't sent to Discord, but it's kept in the server logs in case the AI gets one wrong.
      console.warn(`photo ${photoId} rejected by the AI: ${verdict.reason}`);
      await hideIfPosted(photoId);
    }
  } catch (e) {
    console.error(`photo check failed for photo ${photoId}:`, e);
  }
}

/** A photo the AI turned down that's already on a post: hides the post and tells the owner. Never throws. */
export async function hideIfPosted(photoId: number) {
  try {
    // Only the call that actually hides the post goes on to send the message, so it's never sent twice.
    const rows = await run(
      `UPDATE posts p SET hidden_by_ai_at = now() FROM photos ph
       WHERE ph.id = $1 AND ph.ai_verdict = 'rejected' AND p.id = ph.post_id AND p.hidden_by_ai_at IS NULL
       RETURNING p.id, ph.url`,
      [photoId],
    );
    if (!rows.length) return;
    const postId = Number(rows[0].id);
    const item = await getForReview("post", postId);
    if (item) await sendAiNotice(item, { hiddenPostId: postId, photoUrl: rows[0].url as string });
  } catch (e) {
    console.error(`hiding photo ${photoId}'s post failed:`, e);
  }
}

/**
 * Someone tried to post a photo the AI had already turned down. The post was refused; this tells the owner and
 * deletes the photo. Never throws.
 */
export async function reportRefusedPost(userId: string, photoId: number, body: string, hall: string | null) {
  try {
    const rows = await run("DELETE FROM photos WHERE id = $1 AND user_id = $2 AND post_id IS NULL RETURNING url, storage_key", [photoId, userId]);
    if (!rows.length) return;
    const image = await download(rows[0].url as string);
    await removePhotos([rows[0].storage_key as string]);
    await sendAiNotice({ what: "Photo post", author: await ensureProfile(userId), hall, body }, { refusedImage: image });
  } catch (e) {
    console.error(`reporting refused photo ${photoId} failed:`, e);
  }
}

async function download(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}
