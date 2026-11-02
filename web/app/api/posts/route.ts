import { after } from "next/server";
import { MAX_POST, createPost, deletePost } from "@/lib/social";
import { removePhotos } from "@/lib/photos";
import { sendForReview } from "@/lib/moderation";
import { hideIfPosted, reportRefusedPost } from "@/lib/photoCheck";
import { hallParam, idParam, reply, textParam, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** { body, hall?, photoId? }: a new post in the Feed. It needs words, a photo, or both. */
export async function POST(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  const payload = await request.json().catch(() => null);
  const body = textParam(payload?.body ?? "", MAX_POST);
  const hall = payload?.hall == null || payload.hall === "" ? null : hallParam(payload.hall);
  const photoId = payload?.photoId == null ? null : idParam(payload.photoId);
  if (body === null || (payload?.hall && !hall) || (payload?.photoId != null && !photoId) || (!body && !photoId))
    return reply({ error: "bad request" }, 400);
  try {
    const result = await createPost(user.id, body, hall, photoId);
    if (!result.ok && result.error === "photo removed") {
      after(() => reportRefusedPost(user.id, photoId!, body, hall));
      return reply({ error: "That photo doesn't look like it's about food, so it can't be posted. Try a different one." }, 400);
    }
    if (!result.ok)
      return reply({ error: result.error === "too many" ? "You've posted a lot today. Try again tomorrow." : "That photo can't be used." }, 400);
    after(async () => {
      await sendForReview("post", result.id);
      // The check may have finished in the moment between the post being checked and saved.
      if (photoId !== null) await hideIfPosted(photoId);
    });
    return reply({ ok: true, id: result.id });
  } catch (e) {
    console.error("posts POST failed:", e);
    return unavailable();
  }
}

/** { id }: deletes one of the signed-in person's own posts or reviews, with its comments, votes and photo. */
export async function DELETE(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  const payload = await request.json().catch(() => null);
  const id = idParam(payload?.id);
  if (!id) return reply({ error: "bad request" }, 400);
  try {
    const { deleted, photoKeys } = await deletePost(user.id, id);
    if (!deleted) return reply({ error: "not found" }, 404);
    await removePhotos(photoKeys);
    return reply({ ok: true });
  } catch (e) {
    console.error("posts DELETE failed:", e);
    return unavailable();
  }
}
