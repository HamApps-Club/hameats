import { getProfile } from "@/lib/social";
import { currentUser, dbEnabled, reply, unavailable } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** A student's public profile: their posts, comments and liked dishes. Disliked dishes only come back on your own. */
export async function GET(_request: Request, ctx: { params: Promise<{ username: string }> }) {
  if (!dbEnabled()) return unavailable();
  const { username } = await ctx.params;
  if (!/^[A-Za-z0-9_]{1,40}$/.test(username)) return reply({ error: "not found" }, 404);
  try {
    const user = await currentUser();
    const profile = await getProfile(username, user?.id);
    return profile ? reply(profile) : reply({ error: "not found" }, 404);
  } catch (e) {
    console.error("profile GET failed:", e);
    return unavailable();
  }
}
