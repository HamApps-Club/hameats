import { MAX_COMMENT, addComment, deleteComment } from "@/lib/social";
import { idParam, reply, textParam, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** { postId, body }: a comment on a post. */
export async function POST(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  const payload = await request.json().catch(() => null);
  const postId = idParam(payload?.postId);
  const body = textParam(payload?.body, MAX_COMMENT);
  if (!postId || !body) return reply({ error: "bad request" }, 400);
  try {
    const result = await addComment(user.id, postId, body);
    if (!result.ok)
      return result.error === "missing"
        ? reply({ error: "not found" }, 404)
        : reply({ error: "You've commented a lot today. Try again tomorrow." }, 400);
    return reply({ ok: true, id: result.id });
  } catch (e) {
    console.error("comments POST failed:", e);
    return unavailable();
  }
}

/** { id }: deletes one of the signed-in person's own comments. */
export async function DELETE(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  const payload = await request.json().catch(() => null);
  const id = idParam(payload?.id);
  if (!id) return reply({ error: "bad request" }, 400);
  try {
    return (await deleteComment(user.id, id)) ? reply({ ok: true }) : reply({ error: "not found" }, 404);
  } catch (e) {
    console.error("comments DELETE failed:", e);
    return unavailable();
  }
}
