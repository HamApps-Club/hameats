import "server-only";
import { run, transaction } from "@/lib/db";
import { ensureSchema } from "@/lib/dishes";

// What a logged-in person has on their Profile: favorite dishes, alert settings, saved notifications and the phones
// that get push notifications. Nothing here is ever shown to anyone but its owner.

/** Most favorites one person can keep. */
export const MAX_FAVORITES = 300;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const parseJson = <T>(v: unknown): T | null => {
  if (typeof v !== "string") return (v as T) ?? null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
};

// ---- Favorites

/** The person's favorite dishes, oldest first (the order they were saved). */
export async function getFavorites(userId: string): Promise<string[]> {
  await ensureSchema();
  const rows = await run("SELECT dish FROM favorites WHERE user_id = $1 ORDER BY created_at, dish", [userId]);
  return rows.map((r) => r.dish as string);
}

/** Saves dishes as favorites (already saved ones are left alone), up to MAX_FAVORITES in all. False when that's full. */
export async function addFavorites(userId: string, dishes: string[]): Promise<boolean> {
  await ensureSchema();
  const rows = await run(
    `INSERT INTO favorites (user_id, dish)
     SELECT $1, d FROM unnest($2::text[]) AS d
     WHERE (SELECT count(*) FROM favorites WHERE user_id = $1) + cardinality($2::text[]) <= $3
     ON CONFLICT DO NOTHING RETURNING dish`,
    [userId, dishes, MAX_FAVORITES],
  );
  if (rows.length) return true;
  // Nothing inserted: either they were all saved already (fine), or the list is full.
  const have = await run("SELECT count(*) AS n FROM favorites WHERE user_id = $1 AND dish = ANY($2::text[])", [userId, dishes]);
  return Number(have[0].n) === new Set(dishes).size;
}

export async function removeFavorite(userId: string, dish: string) {
  await ensureSchema();
  await transaction([
    ["DELETE FROM favorites WHERE user_id = $1 AND dish = $2", [userId, dish]],
    ["DELETE FROM alert_mutes WHERE user_id = $1 AND dish = $2", [userId, dish]],
  ]);
}

// ---- The signed-in person

export type Me = { unreadNotifications: number };

/** How many of the person's notifications they haven't seen (the gold dot on the Profile tab). */
export async function getMe(userId: string): Promise<Me> {
  await ensureSchema();
  const rows = await run("SELECT count(*) AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL", [userId]);
  return { unreadNotifications: Number(rows[0].n) };
}

// ---- Notifications (saved by lib/alerts.ts)

export type NotificationItem = {
  id: number;
  kind: string;
  title: string;
  body: string;
  /** For 'menu' notifications: each favorite on the menu, with its hall slug and meal. */
  items: { dish: string; hall: string; meal: string }[];
  createdAt: string;
  read: boolean;
};

/** The person's latest notifications, newest first. */
export async function getNotifications(userId: string): Promise<NotificationItem[]> {
  await ensureSchema();
  const rows = await run(
    "SELECT id, kind, title, body, items, created_at, read_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 60",
    [userId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    kind: r.kind as string,
    title: r.title as string,
    body: r.body as string,
    items: parseJson<NotificationItem["items"]>(r.items) ?? [],
    createdAt: iso(r.created_at),
    read: r.read_at != null,
  }));
}

/** The person opened their Notifications: they've all been seen, which clears the dot on the Profile tab. */
export async function markNotificationsRead(userId: string) {
  await ensureSchema();
  await run("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [userId]);
}

// ---- Alert settings

export type AlertDish = { name: string; halls: string[]; dinerOnly: boolean };
export type Settings = { alerts: boolean; email: boolean; push: boolean; muted: string[]; dishes: AlertDish[]; devices: number };

/** The person's alert choices, and their favorites to choose from (with the halls each has been served at). */
export async function getSettings(userId: string): Promise<Settings> {
  await ensureSchema();
  const [prefs, muted, dishes, devices] = await Promise.all([
    run("SELECT alerts, email, push FROM notification_prefs WHERE user_id = $1", [userId]),
    run("SELECT dish FROM alert_mutes WHERE user_id = $1", [userId]),
    run(
      `SELECT f.dish, COALESCE(array_agg(DISTINCT s.hall) FILTER (WHERE s.hall IS NOT NULL), '{}') AS halls
       FROM favorites f LEFT JOIN dish_servings s ON s.dish = f.dish
       WHERE f.user_id = $1 GROUP BY f.dish ORDER BY f.dish`,
      [userId],
    ),
    run("SELECT count(*) AS n FROM push_subscriptions WHERE user_id = $1", [userId]),
  ]);
  const p = prefs[0];
  const halls = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : String(v).replace(/^\{|\}$/g, "").split(",").filter(Boolean));
  return {
    alerts: p ? p.alerts === true : false,
    email: p ? p.email === true : true,
    push: p ? p.push === true : false,
    muted: muted.map((m) => m.dish as string),
    dishes: dishes.map((d) => {
      const h = halls(d.halls);
      return { name: d.dish as string, halls: h, dinerOnly: h.length > 0 && h.every((x) => x === "diner") };
    }),
    devices: Number(devices[0].n),
  };
}

export async function saveSettings(userId: string, s: { alerts: boolean; email: boolean; push: boolean; muted: string[] }) {
  await ensureSchema();
  await transaction([
    [
      `INSERT INTO notification_prefs (user_id, alerts, email, push) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET alerts = EXCLUDED.alerts, email = EXCLUDED.email, push = EXCLUDED.push, updated_at = now()`,
      [userId, s.alerts, s.email, s.push],
    ],
    ["DELETE FROM alert_mutes WHERE user_id = $1", [userId]],
    ["INSERT INTO alert_mutes (user_id, dish) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING", [userId, s.muted]],
  ]);
}

export async function savePushSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string }) {
  await ensureSchema();
  await run(
    `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [sub.endpoint, userId, sub.p256dh, sub.auth],
  );
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  await ensureSchema();
  await run("DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2", [endpoint, userId]);
}
