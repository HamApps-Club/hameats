import "server-only";
import { auth } from "@/lib/auth";
import { dbEnabled } from "@/lib/db";
import { HALLS } from "@/lib/halls";

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

/** A JSON answer that's never cached. */
export const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: noStore });

/**
 * The checks every request that writes something needs: a database, a request from this site, and a login. Returns the
 * signed-in person, or the response to send instead.
 */
export async function writer(request: Request): Promise<{ id: string; name?: string | null } | Response> {
  if (!dbEnabled()) return unavailable();
  if (!sameOrigin(request)) return reply({ error: "forbidden" }, 403);
  const user = await currentUser();
  return user ?? reply({ error: "login required" }, 401);
}

/** A database id from a request: a whole number of 1 or more. */
export function idParam(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** A dining hall from a request: one of the hall slugs (commons, mcewen, diner, little-pub). */
export function hallParam(value: unknown): string | null {
  return typeof value === "string" && HALLS.some((h) => h.slug === value) ? value : null;
}

/** Text someone wrote: trimmed, with no more than `max` characters, or null when it's too long or not text. */
export function textParam(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n/g, "\n").trim();
  return text.length <= max ? text : null;
}
