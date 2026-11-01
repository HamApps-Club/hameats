import { getMe, renameUser } from "@/lib/social";
import { photosEnabled } from "@/lib/photos";
import { currentUser, dbEnabled, reply, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** Who's signed in (their username, never their email), and what the app can do: photos, and push notifications. */
export async function GET() {
  if (!dbEnabled()) return unavailable();
  const features = { photos: photosEnabled(), pushKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null };
  const user = await currentUser();
  if (!user) return reply({ signedIn: false, ...features });
  try {
    return reply({ signedIn: true, ...(await getMe(user.id)), ...features });
  } catch (e) {
    console.error("me GET failed:", e);
    return unavailable();
  }
}

/** { username }: changes the signed-in person's username. */
export async function PATCH(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  const body = await request.json().catch(() => null);
  const name = typeof body?.username === "string" ? body.username.trim() : "";
  try {
    const problem = await renameUser(user.id, name);
    if (problem) return reply({ error: problem }, 400);
    return reply({ ok: true, username: name });
  } catch (e) {
    console.error("me PATCH failed:", e);
    return unavailable();
  }
}
