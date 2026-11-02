import "server-only";
import webpush from "web-push";
import { run } from "@/lib/db";
import { ensureSchema } from "@/lib/dishes";
import { HALL_SHORT } from "@/lib/halls";

// The morning alert: for everyone who turned alerts and push on, the dishes they liked (and didn't switch off) that
// are on today's menu, in one notification. Howard Diner dishes are left out: the Diner serves them every day.

export type DishToday = { dish: string; hall: string; meal: string };
export type UserAlert = { userId: string; dishes: DishToday[] };

const MEAL_ORDER = "CASE s.meal WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2 ELSE 3 END";

/** Who gets an alert today, and for which dishes. People already sent one today are skipped. */
export async function alertsFor(day: string): Promise<UserAlert[]> {
  await ensureSchema();
  await run(
    `CREATE TABLE IF NOT EXISTS alerts_sent (
       user_id text NOT NULL,
       served_on date NOT NULL,
       sent_at timestamptz NOT NULL DEFAULT now(),
       PRIMARY KEY (user_id, served_on)
     )`,
  );
  const rows = await run(
    `SELECT p.user_id, s.dish, s.hall, s.meal
     FROM notification_prefs p
     JOIN dish_likes l ON l.user_id = p.user_id AND l.value = 1
     JOIN dish_servings s ON s.dish = l.dish AND s.served_on = $1::date AND s.hall <> 'diner'
     WHERE p.alerts AND p.push
       AND NOT EXISTS (SELECT 1 FROM alert_mutes m WHERE m.user_id = p.user_id AND m.dish = l.dish)
       AND NOT EXISTS (SELECT 1 FROM alerts_sent a WHERE a.user_id = p.user_id AND a.served_on = $1::date)
       AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = p.user_id)
     ORDER BY p.user_id, ${MEAL_ORDER}, s.dish, s.hall`,
    [day],
  );
  const byUser = new Map<string, DishToday[]>();
  for (const r of rows) {
    const list = byUser.get(r.user_id as string) ?? [];
    list.push({ dish: r.dish as string, hall: r.hall as string, meal: r.meal as string });
    byUser.set(r.user_id as string, list);
  }
  return [...byUser].map(([userId, dishes]) => ({ userId, dishes }));
}

/** "Chicken Riggies at McEwen for dinner", plus "and 2 more" when there are several. */
export function alertText(dishes: DishToday[]) {
  // A dish served at more than one hall or meal is named once, at its first.
  const seen = new Set<string>();
  const unique = dishes.filter((d) => !seen.has(d.dish) && seen.add(d.dish));
  const first = unique[0];
  const where = `${HALL_SHORT[first.hall] ?? first.hall} for ${first.meal.toLowerCase()}`;
  const rest = unique.length - 1;
  return {
    title: unique.length === 1 ? `${first.dish} is on today` : `${unique.length} dishes you like are on today`,
    body: rest > 0 ? `${first.dish} at ${where}, and ${rest} more.` : `At ${where}.`,
    url: "/",
  };
}

type Sender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<void>;

/** Sends today's alerts. Phones that no longer accept notifications (404 or 410) are forgotten. */
export async function sendAlerts(day: string, send: Sender = defaultSender()) {
  const alerts = await alertsFor(day);
  let notified = 0;
  let removed = 0;
  for (const a of alerts) {
    const subs = await run("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1", [a.userId]);
    const payload = JSON.stringify(alertText(a.dishes));
    let delivered = false;
    for (const s of subs) {
      try {
        await send({ endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } }, payload);
        delivered = true;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await run("DELETE FROM push_subscriptions WHERE endpoint = $1", [s.endpoint]);
          removed++;
        } else console.error("push failed:", status, (e as Error).message);
      }
    }
    if (delivered) {
      await run("INSERT INTO alerts_sent (user_id, served_on) VALUES ($1, $2::date) ON CONFLICT DO NOTHING", [a.userId, day]);
      notified++;
    }
  }
  return { people: alerts.length, notified, removed };
}

export const pushReady = () => !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;

function defaultSender(): Sender {
  webpush.setVapidDetails("mailto:bntaylor@hamilton.edu", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  return async (sub, payload) => {
    await webpush.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: "normal" });
  };
}
