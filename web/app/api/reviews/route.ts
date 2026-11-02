import { after } from "next/server";
import { deleteReview, getReviews, saveReview, type ReviewPlace } from "@/lib/dishes";
import { MEALS } from "@/lib/types";
import { currentUser, dbEnabled, dishParam, hallParam, noStore, sameOrigin, unavailable } from "@/lib/apiGuard";
import { sendForReview } from "@/lib/moderation";

export const dynamic = "force-dynamic";

const MAX_REVIEW = 500;

/** ?dish=: the reviews written about a dish, newest first. */
export async function GET(request: Request) {
  if (!dbEnabled()) return unavailable();
  const dish = dishParam(new URL(request.url).searchParams.get("dish"));
  if (!dish) return Response.json({ error: "bad request" }, { status: 400, headers: noStore });
  try {
    const user = await currentUser();
    return Response.json({ reviews: await getReviews(dish, user?.id) }, { headers: noStore });
  } catch (e) {
    console.error("reviews GET failed:", e);
    return unavailable();
  }
}

/** Where the review was written from, when the request says (the hall card, day and meal on the Menu). */
function placeParam(p: { hall?: unknown; date?: unknown; meal?: unknown } | null): ReviewPlace | null {
  const hall = hallParam(p?.hall);
  const date = typeof p?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : null;
  const meal = typeof p?.meal === "string" && (MEALS as readonly string[]).includes(p.meal) ? p.meal : null;
  return hall ? { hall, date, meal } : null;
}

/** { dish, body, hall?, date?, meal? }: writes (or replaces) the signed-in person's review of a dish. */
export async function POST(request: Request) {
  if (!dbEnabled()) return unavailable();
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403, headers: noStore });
  const user = await currentUser();
  if (!user) return Response.json({ error: "login required" }, { status: 401, headers: noStore });

  const payload = await request.json().catch(() => null);
  const dish = dishParam(payload?.dish);
  const text = typeof payload?.body === "string" ? payload.body.trim() : "";
  if (!dish || !text || text.length > MAX_REVIEW) return Response.json({ error: "bad request" }, { status: 400, headers: noStore });
  try {
    const id = await saveReview(dish, user.id, text, placeParam(payload));
    if (id === null) return Response.json({ error: "unknown dish" }, { status: 404, headers: noStore });
    after(() => sendForReview("post", id));
    return Response.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("reviews POST failed:", e);
    return unavailable();
  }
}

/** { dish }: deletes the signed-in person's review of a dish. */
export async function DELETE(request: Request) {
  if (!dbEnabled()) return unavailable();
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403, headers: noStore });
  const user = await currentUser();
  if (!user) return Response.json({ error: "login required" }, { status: 401, headers: noStore });

  const payload = await request.json().catch(() => null);
  const dish = dishParam(payload?.dish);
  if (!dish) return Response.json({ error: "bad request" }, { status: 400, headers: noStore });
  try {
    await deleteReview(dish, user.id);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("reviews DELETE failed:", e);
    return unavailable();
  }
}
