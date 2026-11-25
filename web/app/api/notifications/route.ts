import { getNotifications, markNotificationsRead } from "@/lib/profile";
import { currentUser, dbEnabled, reply, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** The signed-in person's notifications (the morning menu alerts), newest first. */
export async function GET() {
  if (!dbEnabled()) return unavailable();
  const user = await currentUser();
  if (!user) return reply({ error: "log in first" }, 401);
  try {
    return reply({ notifications: await getNotifications(user.id) });
  } catch (e) {
    console.error("notifications GET failed:", e);
    return unavailable();
  }
}

/** The person opened their Notifications: marks them all read. */
export async function POST(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  try {
    await markNotificationsRead(user.id);
    return reply({ ok: true });
  } catch (e) {
    console.error("notifications POST failed:", e);
    return unavailable();
  }
}
