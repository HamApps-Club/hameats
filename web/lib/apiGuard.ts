import "server-only";
import { auth } from "@/lib/auth";
import { dbEnabled } from "@/lib/db";

/** Browsers send Origin on every POST/DELETE; it must be this site. Stops other sites from acting on a visitor's behalf. */
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** The signed-in person's Google account ID and name, or null. Never throws (a missing auth setup is "signed out"). */
export async function currentUser() {
  try {
    const session = await auth();
    const id = session?.user?.id;
    return id ? { id, name: session.user.name } : null;
  } catch {
    return null;
  }
}

export const noStore = { "Cache-Control": "no-store" };

export const unavailable = () => Response.json({ error: "unavailable" }, { status: 503, headers: noStore });

export { dbEnabled };

/** A dish name from a request: a string of 1-200 characters, trimmed. */
export function dishParam(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const dish = value.trim();
  return dish.length >= 1 && dish.length <= 200 ? dish : null;
}
