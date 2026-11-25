import { timingSafeEqual } from "node:crypto";
import { sendAlerts } from "@/lib/alerts";
import { storeEnabled } from "@/lib/users";
import { campusNow } from "@/lib/hours";
import { fetchMenus } from "@/lib/nutrislice";
import { withMirroredMenus } from "@/lib/mirroredMenus";
import { withSpecials } from "@/lib/specials";
import { withStandingMenus } from "@/lib/standingMenus";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The campus hour (Eastern time) the alerts go out in. */
const ALERT_HOUR = 8;

/**
 * The scheduler sends "Authorization: Bearer <CRON_SECRET>": on AWS, the Lambda handler (web/lambda/index.mjs) does,
 * when EventBridge Scheduler invokes it (infra/aws/hameats.yaml). Nothing else may start the alerts.
 */
function fromScheduler(request: Request) {
  const secret = process.env.CRON_SECRET;
  const got = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return !!secret && secret.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/**
 * The morning alerts, at 8 AM on campus. EventBridge Scheduler runs this at 8:00 America/New_York; only a run that lands
 * in the 8 o'clock hour on campus sends anything; ?force=1 sends at any hour, for testing. Fetches today's menus, then sends each person with
 * notifications on one notification about their favorites on it.
 */
export async function GET(request: Request) {
  if (!fromScheduler(request)) return new Response("unauthorized", { status: 401 });
  if (!storeEnabled()) return Response.json({ skipped: "favorites table not set up" });
  const now = campusNow();
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force && Math.floor(now.minutes / 60) !== ALERT_HOUR) return Response.json({ skipped: `not ${ALERT_HOUR} AM on campus` });
  try {
    const menus = await fetchMenus(1, 0);
    const result = await sendAlerts(withSpecials(withMirroredMenus(withStandingMenus(menus))), now.iso);
    console.log("alerts:", JSON.stringify(result));
    return Response.json(result);
  } catch (e) {
    console.error("alerts failed:", e);
    return new Response("failed", { status: 500 });
  }
}
