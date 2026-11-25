import { getUser } from "@/lib/users";
import { currentUser, reply, storeEnabled, unavailable } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** Whether someone is signed in, and the key for push notifications. The first time someone signed in is seen, their record is created. */
export async function GET() {
  if (!storeEnabled()) return unavailable();
  const features = { pushKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null };
  const user = await currentUser();
  if (!user) return reply({ signedIn: false, ...features });
  try {
    await getUser(user.id);
    return reply({ signedIn: true, ...features });
  } catch (e) {
    console.error("me GET failed:", e);
    return unavailable();
  }
}
