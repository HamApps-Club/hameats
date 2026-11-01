import { markFeedSeen } from "@/lib/social";
import { reply, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** The signed-in person opened the Feed: clears the dot on the Feed tab. */
export async function POST(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  try {
    await markFeedSeen(user.id);
    return reply({ ok: true });
  } catch (e) {
    console.error("feed seen failed:", e);
    return unavailable();
  }
}
