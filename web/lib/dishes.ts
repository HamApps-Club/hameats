import "server-only";
import { run } from "@/lib/db";
import { HALLS } from "@/lib/halls";
import { MEALS, type MenuData } from "@/lib/types";

// The database. It's only used by people who log in: their favorite dishes, and the morning alerts about them.
// Dishes are keyed by name alone, so "Chicken Tenders" is one dish whichever hall serves it. Where and when a dish is
// served is kept separately (dish_servings), which is how the alerts know a favorite is on today.
//
// People are stored by their (lowercased) Hamilton email address, which is never shown anywhere.
//
// Older versions of HamEats had a Feed, reviews, votes and profiles. Their tables (posts, comments, photos, dish_likes,
// profiles and the rest) are no longer created or read; lib/account.ts still clears a person's rows from them when
// they delete their account. Every statement below is safe to run again. They run when SCHEMA_VERSION changes.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS dishes (
     name text PRIMARY KEY,
     first_seen timestamptz NOT NULL DEFAULT now()
   )`,
  // ---- Where and when each dish is served: one row per dish, hall, day and meal, written whenever the menus are fetched.
  `CREATE TABLE IF NOT EXISTS dish_servings (
     dish text NOT NULL REFERENCES dishes (name) ON DELETE CASCADE,
     hall text NOT NULL,
     served_on date NOT NULL,
     meal text NOT NULL,
     PRIMARY KEY (dish, hall, served_on, meal)
   )`,
  "CREATE INDEX IF NOT EXISTS dish_servings_day ON dish_servings (served_on, hall)",

  // ---- Each person's favorite dishes, shown on their Profile.
  `CREATE TABLE IF NOT EXISTS favorites (
     user_id text NOT NULL,
     dish text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (user_id, dish)
   )`,
  // Thumbs ups from the old version were what the morning alerts followed, so they carry over as favorites, once.
  `DO $$ BEGIN
     IF to_regclass('dish_likes') IS NOT NULL THEN
       INSERT INTO favorites (user_id, dish, created_at)
       SELECT user_id, dish, created_at FROM dish_likes WHERE value = 1 ON CONFLICT DO NOTHING;
     END IF;
   END $$`,

  // ---- Alerts for favorite dishes. No row means alerts are off.
  `CREATE TABLE IF NOT EXISTS notification_prefs (
     user_id text PRIMARY KEY,
     alerts boolean NOT NULL DEFAULT false,
     email boolean NOT NULL DEFAULT true,
     push boolean NOT NULL DEFAULT false,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  // Favorites someone switched alerts off for.
  `CREATE TABLE IF NOT EXISTS alert_mutes (
     user_id text NOT NULL,
     dish text NOT NULL,
     PRIMARY KEY (user_id, dish)
   )`,
  // One row per phone or browser that allowed notifications.
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
     endpoint text PRIMARY KEY,
     user_id text NOT NULL,
     p256dh text NOT NULL,
     auth text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  "CREATE INDEX IF NOT EXISTS push_by_user ON push_subscriptions (user_id)",

  // ---- Notifications saved for the person, shown under Notifications on their Profile. kind 'menu' is the morning
  // alert (lib/alerts.ts): at most one a day, so the same day can't be sent twice. items: [{dish, hall, meal}].
  `CREATE TABLE IF NOT EXISTS notifications (
     id bigserial PRIMARY KEY,
     user_id text NOT NULL,
     kind text NOT NULL,
     served_on date,
     title text NOT NULL,
     body text NOT NULL,
     items jsonb NOT NULL DEFAULT '[]',
     created_at timestamptz NOT NULL DEFAULT now(),
     read_at timestamptz
   )`,
  "CREATE INDEX IF NOT EXISTS notifications_by_user ON notifications (user_id, created_at DESC)",
  "CREATE UNIQUE INDEX IF NOT EXISTS notifications_once_a_day ON notifications (user_id, kind, served_on)",
  // Who has been sent a push for a day (lib/alerts.ts).
  `CREATE TABLE IF NOT EXISTS alerts_sent (
     user_id text NOT NULL,
     served_on date NOT NULL,
     sent_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (user_id, served_on)
   )`,

  "CREATE TABLE IF NOT EXISTS schema_meta (id integer PRIMARY KEY CHECK (id = 1), version integer NOT NULL)",
];

/** Bump whenever SCHEMA changes, so every server runs the new statements once. */
const SCHEMA_VERSION = 7;

let schemaReady: Promise<void> | undefined;

/**
 * Creates or updates the tables the first time anything needs them. A server that finds the current version already
 * recorded does one quick read and nothing else, so only the first request after a change runs the statements.
 */
export function ensureSchema() {
  schemaReady ??= (async () => {
    const current = await run("SELECT version FROM schema_meta WHERE id = 1").catch(() => []);
    if (Number(current[0]?.version) === SCHEMA_VERSION) return;
    for (const statement of SCHEMA) await run(statement);
    await run(
      "INSERT INTO schema_meta (id, version) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version",
      [SCHEMA_VERSION],
    );
  })().catch((e) => {
    schemaReady = undefined;
    throw e;
  });
  return schemaReady;
}

/** Every dish name in the menus: what Nutrislice posted plus the hand-added specials and standing menus. */
export function dishNames(data: MenuData): string[] {
  const names = new Set<string>();
  for (const day of Object.values(data.dates))
    for (const meals of Object.values(day))
      for (const stations of Object.values(meals))
        for (const items of Object.values(stations))
          for (const item of items) if (item.name.trim()) names.add(item.name.trim());
  return [...names];
}

/** Every (dish, hall, day, meal) in the menus. */
export function dishServings(data: MenuData) {
  const rows = { dish: [] as string[], hall: [] as string[], day: [] as string[], meal: [] as string[] };
  const seen = new Set<string>();
  for (const [day, locations] of Object.entries(data.dates)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    for (const [location, meals] of Object.entries(locations)) {
      const hall = HALLS.find((h) => h.name === location)?.slug;
      if (!hall) continue;
      for (const [meal, stations] of Object.entries(meals)) {
        if (!(MEALS as readonly string[]).includes(meal)) continue;
        for (const items of Object.values(stations))
          for (const item of items) {
            const dish = item.name.trim();
            const key = `${dish}\u0000${hall}\u0000${day}\u0000${meal}`;
            if (!dish || seen.has(key)) continue;
            seen.add(key);
            rows.dish.push(dish);
            rows.hall.push(hall);
            rows.day.push(day);
            rows.meal.push(meal);
          }
      }
    }
  }
  return rows;
}

/**
 * Saves the names of any dishes not seen before and where and when each is served (the morning alerts read this).
 */
export async function recordMenu(data: MenuData) {
  const names = dishNames(data);
  if (!names.length) return;
  await ensureSchema();
  await run("INSERT INTO dishes (name) SELECT DISTINCT unnest($1::text[]) ON CONFLICT (name) DO NOTHING", [names]);
  const s = dishServings(data);
  await run(
    `INSERT INTO dish_servings (dish, hall, served_on, meal)
     SELECT * FROM unnest($1::text[], $2::text[], $3::date[], $4::text[]) ON CONFLICT DO NOTHING`,
    [s.dish, s.hall, s.day, s.meal],
  );
}
