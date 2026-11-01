import { usernameUnavailable } from "@/lib/social";
import { currentUser, dbEnabled, reply, unavailable } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** ?name=: whether a username is free (problem is null) or why it can't be used. For the live check while typing. */
export async function GET(request: Request) {
  if (!dbEnabled()) return unavailable();
  const name = (new URL(request.url).searchParams.get("name") ?? "").trim();
  try {
    const user = await currentUser();
    return reply({ problem: await usernameUnavailable(name, user?.id) });
  } catch (e) {
    console.error("username GET failed:", e);
    return unavailable();
  }
}
