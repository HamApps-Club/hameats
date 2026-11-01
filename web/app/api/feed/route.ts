import { decodeCursor, getFeed } from "@/lib/social";
import { currentUser, dbEnabled, reply, unavailable } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** ?cursor=: one page of the Feed, newest first, and the cursor for the next page (null at the end). Open to everyone. */
export async function GET(request: Request) {
  if (!dbEnabled()) return unavailable();
  const cursor = decodeCursor(new URL(request.url).searchParams.get("cursor"));
  try {
    const user = await currentUser();
    return reply(await getFeed(user?.id, cursor));
  } catch (e) {
    console.error("feed GET failed:", e);
    return unavailable();
  }
}
