import "server-only";
import webpush from "web-push";
import { run } from "@/lib/db";
import { ensureSchema } from "@/lib/dishes";

// The morning alert: for everyone who turned alerts on, their favorite dishes (the ones they didn't switch off) that are
// on today's menu, each with its dining hall and meal. It's saved as a notification on their Profile (Notifications)
// and, when they turned push on, sent to their phones as one notification. Howard Diner dishes are left out: the Diner
// serves them every day.

export type DishToday = { dish: string; hall: string; meal: string };
export type UserAlert = { userId: string; push: boolean; dishes: DishToday[] };

/** Hall names as students say them, for the notification text. */
const HALL_NAME: Record<string, string> = { commons: "Soper Commons", mcewen: "McEwen", diner: "Howard Diner", "little-pub": "Little Pub" };
export const hallName = (slug: string) => HALL_NAME[slug] ?? slug;

const MEALS = ["Breakfast", "Lunch", "Dinner"];
const mealRank = (meal: string) => (MEALS.indexOf(meal) + 4) % 4; // Unknown meals go last.
const MEAL_ORDER = "CASE s.meal WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2 WHEN 'Dinner' THEN 3 ELSE 4 END";

/** Where tapping the notification (on the phone or in the app) takes you: the Notifications on your Profile. */
export const NOTIFICATIONS_URL = "/#notifications";

/** Who gets an alert today, and for which dishes. People already sent one today are skipped. */
export async function alertsFor(day: string): Promise<UserAlert[]> {
  await ensureSchema();
  const rows = await run(
    `SELECT p.user_id, p.push AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = p.user_id) AS push,
            s.dish, s.hall, s.meal
     FROM notification_prefs p
     JOIN favorites f ON f.user_id = p.user_id
     JOIN dish_servings s ON s.dish = f.dish AND s.served_on = $1::date AND s.hall <> 'diner'
     WHERE p.alerts
       AND NOT EXISTS (SELECT 1 FROM alert_mutes m WHERE m.user_id = p.user_id AND m.dish = f.dish)
       AND NOT EXISTS (SELECT 1 FROM alerts_sent a WHERE a.user_id = p.user_id AND a.served_on = $1::date)
       AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = p.user_id AND n.kind = 'menu' AND n.served_on = $1::date)
     ORDER BY p.user_id, ${MEAL_ORDER}, s.dish, s.hall`,
    [day],
  );
  const byUser = new Map<string, UserAlert>();
  for (const r of rows) {
    const id = r.user_id as string;
    const a = byUser.get(id) ?? { userId: id, push: r.push === true, dishes: [] };
    a.dishes.push({ dish: r.dish as string, hall: r.hall as string, meal: r.meal as string });
    byUser.set(id, a);
  }
  return [...byUser.values()];
}

/** "a", "a and b", "a, b and c". */
const and = (words: string[]) => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`);

/**
 * One line per dish, naming every hall and meal it's served at: "Chicken Riggies at McEwen for dinner",
 * "Pizza at Soper Commons and McEwen for lunch", "Pancakes at Soper Commons for breakfast, McEwen for lunch".
 */
export function dishLines(dishes: DishToday[]) {
  const byDish = new Map<string, Map<string, Set<string>>>();
  for (const d of dishes) {
    const meals = byDish.get(d.dish) ?? new Map<string, Set<string>>();
    meals.set(d.meal, (meals.get(d.meal) ?? new Set()).add(hallName(d.hall)));
    byDish.set(d.dish, meals);
  }
  return [...byDish].map(([dish, meals]) => {
    // Meals in order; neighbouring meals at the same halls are named together ("for lunch and dinner").
    const parts: { halls: string; meals: string[] }[] = [];
    for (const meal of [...meals.keys()].sort((a, b) => mealRank(a) - mealRank(b))) {
      const halls = and([...meals.get(meal)!].sort());
      const last = parts[parts.length - 1];
      if (last?.halls === halls) last.meals.push(meal.toLowerCase());
      else parts.push({ halls, meals: [meal.toLowerCase()] });
    }
    return `${dish} at ${parts.map((p) => `${p.halls} for ${and(p.meals)}`).join(", ")}`;
  });
}

/** Lines shown on the phone's notification before "and N more". */
const PUSH_LINES = 4;

/** The notification: the title, every dish with its hall and meal, and where tapping it goes. */
export function alertText(dishes: DishToday[]) {
  const lines = dishLines(dishes);
  const title = lines.length === 1 ? `${dishes[0].dish} is on today` : `${lines.length} of your favorites are on today`;
  const shown = lines.length > PUSH_LINES ? [...lines.slice(0, PUSH_LINES - 1), `and ${lines.length - PUSH_LINES + 1} more`] : lines;
  return { title, body: lines.join("\n"), pushBody: shown.join("\n"), url: NOTIFICATIONS_URL };
}

type Sender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<void>;

/**
 * Saves today's notifications and sends them to phones (when push is set up: VAPID keys). Phones that no longer accept notifications (404 or 410) are
 * forgotten. Each person gets at most one a day: the saved notification is the record (see notifications_once_a_day).
 */
export async function sendAlerts(day: string, send: Sender | null = pushReady() ? defaultSender() : null) {
  const alerts = await alertsFor(day);
  let saved = 0;
  let notified = 0;
  let removed = 0;
  for (const a of alerts) {
    const text = alertText(a.dishes);
    const inserted = await run(
      `INSERT INTO notifications (user_id, kind, served_on, title, body, items) VALUES ($1, 'menu', $2::date, $3, $4, $5::jsonb)
       ON CONFLICT DO NOTHING RETURNING id`,
      [a.userId, day, text.title, text.body, JSON.stringify(a.dishes)],
    );
    if (!inserted.length) continue;
    saved++;
    if (!a.push || !send) continue;
    const subs = await run("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1", [a.userId]);
    const payload = JSON.stringify({ title: text.title, body: text.pushBody, url: text.url, tag: `menu-${day}` });
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
  return { people: alerts.length, saved, notified, removed };
}

export const pushReady = () => !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;

function defaultSender(): Sender {
  webpush.setVapidDetails("mailto:bntaylor@hamilton.edu", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  return async (sub, payload) => {
    await webpush.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: "normal" });
  };
}
