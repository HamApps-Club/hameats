import { getUser, setNotify } from "@/lib/users";
import { currentUser, noStore, reply, storeEnabled, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

/** { notify }: whether the signed-in person's morning alert is on. */
export async function GET() {
  if (!storeEnabled()) return unavailable();
  const user = await currentUser();
  if (!user) return Response.json({ error: "login required" }, { status: 401, headers: noStore });
  try {
    return reply({ notify: (await getUser(user.id)).notify });
  } catch (e) {
    console.error("settings GET failed:", e);
    return unavailable();
  }
}

const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

/**
 * { notify: true, push: { endpoint, keys: { p256dh, auth } } }: turns notifications on, for this phone (the push address
 * its browser gave when the person allowed notifications). { notify: false }: turns them off and erases every push address.
 */
export async function PUT(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  const b = await request.json().catch(() => null);
  try {
    if (b?.notify === false) {
      await setNotify(user.id, false);
      return reply({ notify: false });
    }
    const p = b?.push;
    const ok =
      b?.notify === true && isText(p?.endpoint, 1000) && /^https:\/\//.test(p.endpoint) && isText(p?.keys?.p256dh, 200) && isText(p?.keys?.auth, 100);
    if (!ok) return reply({ error: "bad request" }, 400);
    await setNotify(user.id, true, { endpoint: p.endpoint, p256dh: p.keys.p256dh, auth: p.keys.auth });
    return reply({ notify: true });
  } catch (e) {
    console.error("settings PUT failed:", e);
    return unavailable();
  }
}
