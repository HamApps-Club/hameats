import { decodeCursor, getFeed } from "@/lib/social";
import { currentUser, dbEnabled, reply, unavailable } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** ?cursor=&kind=review|post: one page of the Feed (all of it, or only reviews or posts), newest first, and the cursor for the next page (null at the end). Open to everyone. */
export async function GET(request: Request) {
  if (!dbEnabled()) return unavailable();
  const params = new URL(request.url).searchParams;
  const cursor = decodeCursor(params.get("cursor"));
  const k = params.get("kind");
  const kind = k === "review" || k === "post" ? k : "all";
  try {
    const user = await currentUser();
    return reply(await getFeed(user?.id, cursor, kind));
  } catch (e) {
    console.error("feed GET failed:", e);
    return unavailable();
  }
}
