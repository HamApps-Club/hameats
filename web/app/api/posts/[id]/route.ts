import { getComments, getPost } from "@/lib/social";
import { currentUser, dbEnabled, idParam, reply, unavailable } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** One post with its comments. Open to everyone. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!dbEnabled()) return unavailable();
  const id = idParam((await ctx.params).id);
  if (!id) return reply({ error: "bad request" }, 400);
  try {
    const user = await currentUser();
    const post = await getPost(user?.id, id);
    if (!post) return reply({ error: "not found" }, 404);
    return reply({ post, comments: await getComments(user?.id, id) });
  } catch (e) {
    console.error("post GET failed:", e);
    return unavailable();
  }
}
