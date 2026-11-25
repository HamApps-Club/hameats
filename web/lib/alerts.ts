import "server-only";
import webpush from "web-push";
import { HALLS } from "@/lib/halls";
import { MEALS, type MenuData } from "@/lib/types";
import { forgetPhone, sameDish, usersToNotify, type User } from "@/lib/users";

// The morning alert: for everyone who turned notifications on, their favorites that are on today's menu, each with its
// dining hall and meal, sent to their phones as one notification. Nothing about it is saved. Howard Diner dishes are
// left out: the Diner serves them every day.

export type DishToday = { dish: string; hall: string; meal: string };

/** Hall names as students say them, for the notification text. */
const HALL_NAME: Record<string, string> = { commons: "Soper Commons", mcewen: "McEwen", diner: "Howard Diner", "little-pub": "Little Pub" };
export const hallName = (slug: string) => HALL_NAME[slug] ?? slug;

const mealRank = (meal: string) => ((MEALS as readonly string[]).indexOf(meal) + 4) % 4; // Unknown meals go last.

/** Where tapping the notification takes you: the Menu. */
export const ALERT_URL = "/";

/** Every dish on the menus for `day`, with each hall and meal it's served at (Howard Diner left out), in meal order. */
export function dishesOn(data: MenuData, day: string): DishToday[] {
  const out: DishToday[] = [];
  const seen = new Set<string>();
  for (const [location, meals] of Object.entries(data.dates[day] ?? {})) {
    const hall = HALLS.find((h) => h.name === location)?.slug;
    if (!hall || hall === "diner") continue;
    for (const [meal, stations] of Object.entries(meals)) {
      if (!(MEALS as readonly string[]).includes(meal)) continue;
      for (const items of Object.values(stations))
        for (const item of items) {
          const dish = item.name.trim();
          const key = `${dish.toLowerCase()}|${hall}|${meal}`;
          if (!dish || seen.has(key)) continue;
          seen.add(key);
          out.push({ dish, hall, meal });
        }
    }
  }
  return out.sort((a, b) => mealRank(a.meal) - mealRank(b.meal) || a.dish.localeCompare(b.dish) || a.hall.localeCompare(b.hall));
}

/** The person's favorites among today's dishes, named the way they saved them. */
export function favoritesToday(user: Pick<User, "favorites">, today: DishToday[]): DishToday[] {
  const out: DishToday[] = [];
  for (const d of today) {
    const fav = user.favorites.find((f) => sameDish(f, d.dish));
    if (fav) out.push({ ...d, dish: fav });
  }
  return out;
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
  return { title, body: lines.join("\n"), pushBody: shown.join("\n"), url: ALERT_URL };
}

type Sender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<void>;

/**
 * Sends today's alerts (when push is set up: VAPID keys). Phones that no longer accept notifications (404 or 410) are
 * forgotten. The scheduler runs this once in the 8 o'clock hour (see app/api/cron/alerts/route.ts), so each person gets one a day.
 */
export async function sendAlerts(data: MenuData, day: string, send: Sender | null = pushReady() ? defaultSender() : null) {
  const today = dishesOn(data, day);
  let people = 0;
  let notified = 0;
  let removed = 0;
  if (!send || !today.length) return { people, notified, removed };
  for (const user of await usersToNotify()) {
    const dishes = favoritesToday(user, today);
    if (!dishes.length) continue;
    people++;
    const text = alertText(dishes);
    const payload = JSON.stringify({ title: text.title, body: text.pushBody, url: text.url, tag: `menu-${day}` });
    let delivered = false;
    for (const p of user.push) {
      try {
        await send({ endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } }, payload);
        delivered = true;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await forgetPhone(user.email, p.endpoint);
          removed++;
        } else console.error("push failed:", status, (e as Error).message);
      }
    }
    if (delivered) notified++;
  }
  return { people, notified, removed };
}

export const pushReady = () => !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;

function defaultSender(): Sender {
  webpush.setVapidDetails("mailto:bntaylor@hamilton.edu", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  return async (sub, payload) => {
    await webpush.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: "normal" });
  };
}
