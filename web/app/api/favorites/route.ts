import { MAX_FAVORITES, addFavorites, getFavorites, removeFavorite } from "@/lib/profile";
import { currentUser, dbEnabled, dishParam, noStore, reply, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** The signed-in person's favorite dishes. */
export async function GET() {
  if (!dbEnabled()) return unavailable();
  const user = await currentUser();
  if (!user) return Response.json({ error: "login required" }, { status: 401, headers: noStore });
  try {
    return reply({ favorites: await getFavorites(user.id) });
  } catch (e) {
    console.error("favorites GET failed:", e);
    return unavailable();
  }
}

/**
 * { dish, saved }: saves a dish as a favorite (saved: true) or removes it (saved: false).
 * { dishes: [...] }: saves several at once (favorites starred on this phone before logging in).
 */
export async function POST(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  const b = await request.json().catch(() => null);
  try {
    if (Array.isArray(b?.dishes)) {
      const dishes = [...new Set(b.dishes.map(dishParam))];
      if (!dishes.length || dishes.length > MAX_FAVORITES || dishes.some((d) => !d)) return reply({ error: "bad request" }, 400);
      if (!(await addFavorites(user.id, dishes as string[]))) return reply({ error: `You can save up to ${MAX_FAVORITES} favorites.` }, 400);
      return reply({ favorites: await getFavorites(user.id) });
    }
    const dish = dishParam(b?.dish);
    if (!dish || typeof b?.saved !== "boolean") return reply({ error: "bad request" }, 400);
    if (b.saved) {
      if (!(await addFavorites(user.id, [dish]))) return reply({ error: `You can save up to ${MAX_FAVORITES} favorites.` }, 400);
    } else await removeFavorite(user.id, dish);
    return reply({ ok: true });
  } catch (e) {
    console.error("favorites POST failed:", e);
    return unavailable();
  }
}
