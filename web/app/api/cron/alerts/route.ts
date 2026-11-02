import { timingSafeEqual } from "node:crypto";
import { pushReady, sendAlerts } from "@/lib/alerts";
import { dbEnabled } from "@/lib/db";
import { recordMenu } from "@/lib/dishes";
import { campusNow } from "@/lib/hours";
import { fetchMenus } from "@/lib/menuSource";
import { withMirroredMenus } from "@/lib/mirroredMenus";
import { withSpecials } from "@/lib/specials";
import { withStandingMenus } from "@/lib/standingMenus";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel's scheduler sends "Authorization: Bearer <CRON_SECRET>". Nothing else may start the alerts. */
function fromScheduler(request: Request) {
  const secret = process.env.CRON_SECRET;
  const got = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return !!secret && secret.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/**
 * The morning alerts (see vercel.json for when). Fetches the menus first, so today's dishes are known even if no one has
 * opened the app yet, then sends each person one notification about the liked dishes on today's menu.
 */
export async function GET(request: Request) {
  if (!fromScheduler(request)) return new Response("unauthorized", { status: 401 });
  if (!dbEnabled() || !pushReady()) return Response.json({ skipped: "push or database not set up" });
  try {
    const menus = await fetchMenus(7, 0).catch(() => null);
    if (menus) await recordMenu(withSpecials(withMirroredMenus(withStandingMenus(menus))));
    const result = await sendAlerts(campusNow().iso);
    console.log("alerts:", JSON.stringify(result));
    return Response.json(result);
  } catch (e) {
    console.error("alerts failed:", e);
    return new Response("failed", { status: 500 });
  }
}
