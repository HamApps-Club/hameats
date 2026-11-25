import { deletePushSubscription, savePushSubscription } from "@/lib/profile";
import { reply, unavailable, writer } from "@/lib/apiGuard";

export const dynamic = "force-dynamic";

const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

/** { endpoint, keys: { p256dh, auth } }: this phone allowed notifications. Saves where to send them. */
export async function POST(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  const b = await request.json().catch(() => null);
  const ok = isText(b?.endpoint, 1000) && /^https:\/\//.test(b.endpoint) && isText(b?.keys?.p256dh, 200) && isText(b?.keys?.auth, 100);
  if (!ok) return reply({ error: "bad request" }, 400);
  try {
    await savePushSubscription(user.id, { endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth });
    return reply({ ok: true });
  } catch (e) {
    console.error("push POST failed:", e);
    return unavailable();
  }
}

/** { endpoint }: this phone turned notifications off. */
export async function DELETE(request: Request) {
  const user = await writer(request);
  if (user instanceof Response) return user;
  const b = await request.json().catch(() => null);
  if (!isText(b?.endpoint, 1000)) return reply({ error: "bad request" }, 400);
  try {
    await deletePushSubscription(user.id, b.endpoint);
    return reply({ ok: true });
  } catch (e) {
    console.error("push DELETE failed:", e);
    return unavailable();
  }
}
