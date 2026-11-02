import { timingSafeEqual } from "node:crypto";
import { sendAlerts } from "@/lib/alerts";
import { dbEnabled } from "@/lib/db";
import { recordMenu } from "@/lib/dishes";
import { campusNow } from "@/lib/hours";
import { fetchMenus } from "@/lib/nutrislice";
import { withMirroredMenus } from "@/lib/mirroredMenus";
import { withSpecials } from "@/lib/specials";
import { withStandingMenus } from "@/lib/standingMenus";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The campus hour (Eastern time) the alerts go out in. */
const ALERT_HOUR = 8;

/** Vercel's scheduler sends "Authorization: Bearer <CRON_SECRET>". Nothing else may start the alerts. */
function fromScheduler(request: Request) {
  const secret = process.env.CRON_SECRET;
  const got = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return !!secret && secret.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/**
 * The morning alerts, at 8 AM on campus. Vercel's schedules are in UTC, so vercel.json runs this at both 12:00 and
 * 13:00 UTC (8 AM in summer time and in winter time), and only the run that lands in the 8 o'clock hour on campus
 * sends anything; ?force=1 sends at any hour, for testing. Fetches the menus first, so today's dishes are known even
 * if no one has opened the app yet, then saves and sends each person one notification about the liked dishes on today's menu.
 */
export async function GET(request: Request) {
  if (!fromScheduler(request)) return new Response("unauthorized", { status: 401 });
  if (!dbEnabled()) return Response.json({ skipped: "database not set up" });
  const now = campusNow();
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force && Math.floor(now.minutes / 60) !== ALERT_HOUR) return Response.json({ skipped: `not ${ALERT_HOUR} AM on campus` });
  try {
    const menus = await fetchMenus(7, 0).catch(() => null);
    if (menus) await recordMenu(withSpecials(withMirroredMenus(withStandingMenus(menus))));
    const result = await sendAlerts(now.iso);
    console.log("alerts:", JSON.stringify(result));
    return Response.json(result);
  } catch (e) {
    console.error("alerts failed:", e);
    return new Response("failed", { status: 500 });
  }
}
