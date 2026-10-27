import { publicName } from "@/lib/auth";
import { REPORT_REASONS, REPORTS_TO_HIDE, reportReview } from "@/lib/dishes";
import { notifyOwner } from "@/lib/notify";
import { currentUser, dbEnabled, noStore, sameOrigin, unavailable } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** { id, reason? }: the signed-in person reports a review. The site's owner gets a message naming the reporter. */
export async function POST(request: Request) {
  if (!dbEnabled()) return unavailable();
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403, headers: noStore });
  const user = await currentUser();
  if (!user) return Response.json({ error: "login required" }, { status: 401, headers: noStore });

  const payload = await request.json().catch(() => null);
  const id = Number(payload?.id);
  const reason = typeof payload?.reason === "string" ? payload.reason.trim() : "";
  if (!Number.isSafeInteger(id) || id < 1 || (reason && !(REPORT_REASONS as readonly string[]).includes(reason)))
    return Response.json({ error: "bad request" }, { status: 400, headers: noStore });

  try {
    const result = await reportReview(id, user.id, reason);
    if (result.status === "missing") return Response.json({ error: "not found" }, { status: 404, headers: noStore });
    if (result.status === "own") return Response.json({ error: "own review" }, { status: 400, headers: noStore });
    if (result.status === "duplicate") return Response.json({ ok: true, already: true }, { headers: noStore });

    // The first report, and the one that hides the review, each send a message; the ones in between only add to the count.
    if (result.count === 1 || result.count === REPORTS_TO_HIDE) {
      const email = user.id.includes("@") ? user.id : "no email on file";
      await notifyOwner(
        [
          result.count >= REPORTS_TO_HIDE
            ? `Review hidden: ${result.count} reports`
            : `Review reported (${result.count} so far; it is hidden from others at ${REPORTS_TO_HIDE})`,
          `Dish: ${result.dish}`,
          `Written by: ${result.author}`,
          `Review: ${result.body}`,
          `Reported by: ${publicName(user.name)} (${email})`,
          `Reason: ${reason || "none given"}`,
          `Review id: ${id}`,
        ].join("\n"),
      );
    }
    return Response.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("reviews report failed:", e);
    return unavailable();
  }
}
