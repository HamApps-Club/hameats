import { getLikeState, setLike } from "@/lib/dishes";
import { currentUser, dbEnabled, dishParam, noStore, sameOrigin, unavailable } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** Every dish's thumbs-up count, and which dishes the signed-in person has given one to. */
export async function GET() {
  if (!dbEnabled()) return unavailable();
  try {
    const user = await currentUser();
    return Response.json(await getLikeState(user?.id), { headers: noStore });
  } catch (e) {
    console.error("likes GET failed:", e);
    return unavailable();
  }
}

/** { dish, liked }: gives or takes back the signed-in person's thumbs up. */
export async function POST(request: Request) {
  if (!dbEnabled()) return unavailable();
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403, headers: noStore });
  const user = await currentUser();
  if (!user) return Response.json({ error: "login required" }, { status: 401, headers: noStore });

  const body = await request.json().catch(() => null);
  const dish = dishParam(body?.dish);
  if (!dish || typeof body?.liked !== "boolean") return Response.json({ error: "bad request" }, { status: 400, headers: noStore });
  try {
    const result = await setLike(dish, user.id, body.liked);
    if (!result) return Response.json({ error: "unknown dish" }, { status: 404, headers: noStore });
    return Response.json(result, { headers: noStore });
  } catch (e) {
    console.error("likes POST failed:", e);
    return unavailable();
  }
}
