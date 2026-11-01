import { publicName } from "@/lib/auth";
import { REPORT_REASONS, REPORTS_TO_HIDE, reportComment, reportPost } from "@/lib/dishes";
import { notifyOwner } from "@/lib/notify";
import { idParam, reply, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/**
 * { postId } or { commentId }, with an optional reason: the signed-in person reports a post, review or comment. The
 * site's owner gets a message naming the reporter on the first report, and again when enough reports hide it.
 */
export async function POST(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  const payload = await request.json().catch(() => null);
  const postId = payload?.postId == null ? null : idParam(payload.postId);
  const commentId = payload?.commentId == null ? null : idParam(payload.commentId);
  const reason = typeof payload?.reason === "string" ? payload.reason.trim() : "";
  if (!postId === !commentId || (reason && !(REPORT_REASONS as readonly string[]).includes(reason)))
    return reply({ error: "bad request" }, 400);
  try {
    const result = postId ? await reportPost(postId, user.id, reason) : await reportComment(commentId!, user.id, reason);
    if (result.status === "missing") return reply({ error: "not found" }, 404);
    if (result.status === "own") return reply({ error: "own" }, 400);
    if (result.status === "duplicate") return reply({ ok: true, already: true });
    if (result.count === 1 || result.count === REPORTS_TO_HIDE) {
      const email = user.id.includes("@") ? user.id : "no email on file";
      await notifyOwner(
        [
          result.count >= REPORTS_TO_HIDE
            ? `${result.what} hidden: ${result.count} reports`
            : `${result.what} reported (${result.count} so far; it is hidden from others at ${REPORTS_TO_HIDE})`,
          `Written by: u/${result.author}`,
          `Text: ${result.body || "(photo only)"}`,
          `Reported by: ${publicName(user.name)} (${email})`,
          `Reason: ${reason || "none given"}`,
          postId ? `Post id: ${postId}` : `Comment id: ${commentId}`,
        ].join("\n"),
      );
    }
    return reply({ ok: true });
  } catch (e) {
    console.error("report failed:", e);
    return unavailable();
  }
}
