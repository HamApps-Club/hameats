import { MAX_FAVORITES, addFavorites, getUser, removeFavorite } from "@/lib/users";
import { currentUser, dishParam, noStore, reply, storeEnabled, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

const FULL = `You can save up to ${MAX_FAVORITES} favorites.`;

/** The signed-in person's favorite dishes. */
export async function GET() {
  if (!storeEnabled()) return unavailable();
  const user = await currentUser();
  if (!user) return Response.json({ error: "login required" }, { status: 401, headers: noStore });
  try {
    return reply({ favorites: (await getUser(user.id)).favorites });
  } catch (e) {
    console.error("favorites GET failed:", e);
    return unavailable();
  }
}

/**
 * { dish, saved }: saves a dish as a favorite (saved: true) or removes it (saved: false).
 * { dishes: [...] }: saves several at once (favorites starred on this phone before logging in).
 * Both answer with the whole list.
 */
export async function POST(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  const b = await request.json().catch(() => null);
  try {
    if (Array.isArray(b?.dishes)) {
      const dishes = b.dishes.map(dishParam);
      if (!dishes.length || dishes.length > MAX_FAVORITES || dishes.some((d: string | null) => !d)) return reply({ error: "bad request" }, 400);
      const favorites = await addFavorites(user.id, dishes);
      return favorites ? reply({ favorites }) : reply({ error: FULL }, 400);
    }
    const dish = dishParam(b?.dish);
    if (!dish || typeof b?.saved !== "boolean") return reply({ error: "bad request" }, 400);
    const favorites = b.saved ? await addFavorites(user.id, [dish]) : await removeFavorite(user.id, dish);
    return favorites ? reply({ favorites }) : reply({ error: FULL }, 400);
  } catch (e) {
    console.error("favorites POST failed:", e);
    return unavailable();
  }
}
