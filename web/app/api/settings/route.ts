import { getSettings, saveSettings } from "@/lib/social";
import { currentUser, dbEnabled, dishParam, noStore, reply, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** The signed-in person's alert settings, and the liked dishes they can pick from. */
export async function GET() {
  if (!dbEnabled()) return unavailable();
  const user = await currentUser();
  if (!user) return Response.json({ error: "login required" }, { status: 401, headers: noStore });
  try {
    return reply(await getSettings(user.id));
  } catch (e) {
    console.error("settings GET failed:", e);
    return unavailable();
  }
}

/** { alerts, email, push, muted: dish names switched off }. */
export async function PUT(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  const b = await request.json().catch(() => null);
  const flags = [b?.alerts, b?.email, b?.push];
  const muted = Array.isArray(b?.muted) ? b.muted.map(dishParam) : null;
  if (flags.some((f) => typeof f !== "boolean") || !muted || muted.length > 500 || muted.some((d: string | null) => !d))
    return reply({ error: "bad request" }, 400);
  try {
    await saveSettings(user.id, { alerts: b.alerts, email: b.email, push: b.push, muted });
    return reply({ ok: true });
  } catch (e) {
    console.error("settings PUT failed:", e);
    return unavailable();
  }
}
