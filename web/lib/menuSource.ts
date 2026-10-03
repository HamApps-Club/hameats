import type { MealMenu, MenuData, MenuItem, Nutrition } from "./types";


const BASE_API = "https://menu-api.invalid";
const TIME_ZONE = "America/New_York";

const LOCATIONS: Record<string, string> = {
  "soper-commons": "Soper Commons",
  mcewen: "McEwen Dining Hall",
  "howard-diner": "Howard Diner",
  "little-pub": "Little Pub",
};
const MEALS = ["breakfast", "lunch", "dinner"];

type ApiMenuItem = {
  is_station_header?: boolean;
  is_section_title?: boolean;
  text?: string;
  food?: {
    name?: string;
    description?: string | null;
    ingredients?: string | null;
    serving_size_info?: { serving_size_amount?: string | number | null; serving_size_unit?: string | null } | null;
    rounded_nutrition_info?: Record<string, number | null | undefined> | null;
    icons?: { food_icons?: { name?: string }[] };
  } | null;
};

/** Plain text from a the menu source rich-text field (may contain HTML). */
const plain = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim() || undefined;

const NUTRIENTS: [keyof Nutrition, string][] = [
  ["protein", "g_protein"],
  ["carbs", "g_carbs"],
  ["fat", "g_fat"],
  ["saturatedFat", "g_saturated_fat"],
  ["transFat", "g_trans_fat"],
  ["cholesterolMg", "mg_cholesterol"],
  ["sodium", "mg_sodium"],
  ["fiber", "g_fiber"],
  ["sugar", "g_sugar"],
  ["addedSugar", "g_added_sugar"],
  ["potassiumMg", "mg_potassium"],
  ["calciumMg", "mg_calcium"],
  ["ironMg", "mg_iron"],
  ["vitaminDMcg", "mcg_vitamin_d"],
];

function nutritionOf(info: Record<string, number | null | undefined> | null | undefined): Nutrition | undefined {
  if (!info) return undefined;
  const out: Nutrition = {};
  for (const [key, field] of NUTRIENTS) {
    const v = info[field];
    if (typeof v === "number") out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
type ApiWeek = { days?: { date?: string; menu_items?: ApiMenuItem[] }[] };
type ApiSchool = { slug: string; active_menu_types?: { slug: string }[] };

async function getJson<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate } });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** "YYYY-MM-DD" for today on campus, regardless of the server's time zone. */
function hamiltonToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** Sunday that starts the menu week containing `iso`. */
const sundayOf = (iso: string) => addDays(iso, -weekday(iso));

/**
 * Locations that serve the same menu every week but only have it on the menu source for past weeks
 * (Little Pub), and how far back to look for their latest posted week.
 */
const REPEATS_WEEKLY = new Set(["little-pub"]);
const LOOKBACK_WEEKS = 8;

/** Walk ordered menu items; station headers start a new group. */
function parseDay(items: ApiMenuItem[]): MealMenu {
  const stations: MealMenu = {};
  let current = "General";
  for (const it of items) {
    if (it.is_station_header || it.is_section_title) {
      const name = (it.text ?? "").trim();
      if (name) current = name;
      continue;
    }
    const name = (it.food?.name ?? "").trim();
    if (!name) continue;
    const bucket = (stations[current] ??= []);
    if (bucket.some((x) => x.name === name)) continue;
    const food = it.food;
    const size = food?.serving_size_info;
    const item: MenuItem = {
      name,
      calories: food?.rounded_nutrition_info?.calories ?? null,
      tags: (food?.icons?.food_icons ?? []).map((i) => i.name).filter((n): n is string => !!n),
      description: plain(food?.description),
      serving: size?.serving_size_amount
        ? `${size.serving_size_amount} ${size.serving_size_unit ?? ""}`.trim()
        : undefined,
      ingredients: plain(food?.ingredients),
      nutrition: nutritionOf(food?.rounded_nutrition_info),
    };
    bucket.push(item);
  }
  return Object.fromEntries(Object.entries(stations).filter(([, v]) => v.length));
}

/** Every active menu type per location (e.g. "lunch", "pub-menu"), from the schools list. */
async function activeMenuTypes(revalidate: number): Promise<Record<string, string[]>> {
  try {
    const schools = await getJson<ApiSchool[]>(`${BASE_API}/menu/api/schools/?format=json`, revalidate);
    return Object.fromEntries(
      schools.filter((s) => s.slug in LOCATIONS).map((s) => [s.slug, (s.active_menu_types ?? []).map((m) => m.slug)]),
    );
  } catch {
    return {};
  }
}

/** Which meal tab a menu type belongs on; null if it can't be placed. */
function mealForType(type: string): "Breakfast" | "Lunch" | "Dinner" | null {
  if (/breakfast/.test(type)) return "Breakfast";
  if (/brunch|lunch/.test(type)) return "Lunch";
  if (/dinner|pub|late|night/.test(type)) return "Dinner";
  return null;
}

/** One line per request, for /api/menu/status. */
export type FetchLog = { location: string; menuType: string; week: string; ok: boolean; items: number; error?: string };

export function countItems(data: MenuData) {
  let n = 0;
  for (const day of Object.values(data.dates))
    for (const loc of Object.values(day))
      for (const meal of Object.values(loc)) for (const items of Object.values(meal)) n += items.length;
  return n;
}

/** Fetch the next `days` days of menus for every hall, straight from the menu source. */
export async function fetchMenus(days = 7, revalidate = 86400, log?: FetchLog[]): Promise<MenuData> {
  const start = hamiltonToday();
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const result: MenuData["dates"] = Object.fromEntries(
    dates.map((d) => [d, Object.fromEntries(Object.values(LOCATIONS).map((name) => [name, {}]))]),
  );
  const typesByLoc = await activeMenuTypes(revalidate);

  // Each weeks response covers a Sunday–Saturday week; fetch each (location, menu type, week) once.
  const cache = new Map<string, Promise<ApiWeek | null>>();
  const fetchWeek = (slug: string, display: string, menuType: string, date: string) => {
    const key = `${slug}/${menuType}/${sundayOf(date)}`;
    if (!cache.has(key)) {
      cache.set(
        key,
        (async () => {
          // Full weeks endpoint (not the digest), in the form .../2026/9/23; JSON comes back via the Accept header.
          const [y, m, d] = date.split("-").map(Number);
          const url = `${BASE_API}/menu/api/weeks/school/${slug}/menu-type/${menuType}/${y}/${m}/${d}`;
          try {
            const week = await getJson<ApiWeek>(url, revalidate);
            const items = (week.days ?? []).reduce(
              (n, dd) => n + (dd.menu_items ?? []).filter((x) => x.food?.name).length,
              0,
            );
            log?.push({ location: display, menuType, week: sundayOf(date), ok: true, items });
            return week;
          } catch (e) {
            console.error(`menu fetch failed: ${display} / ${menuType} / ${date}:`, e);
            log?.push({ location: display, menuType, week: sundayOf(date), ok: false, items: 0, error: String(e) });
            return null;
          }
        })(),
      );
    }
    return cache.get(key)!;
  };

  // Always try breakfast/lunch/dinner, plus whatever else a location lists (Little Pub may use its own names).
  const typesFor = (slug: string, display: string) =>
    [...new Set([...MEALS, ...(typesByLoc[slug] ?? [])])].flatMap((menuType) => {
      const meal = mealForType(menuType);
      if (!meal)
        log?.push({ location: display, menuType, week: "-", ok: false, items: 0, error: "no matching meal tab" });
      return meal ? [{ menuType, meal }] : [];
    });

  /** Stations for one location/meal on `sourceDate`, written onto `targetDate`. */
  const fill = async (
    slug: string,
    display: string,
    menuType: string,
    meal: string,
    sourceDate: string,
    targetDate: string,
  ) => {
    const week = await fetchWeek(slug, display, menuType, sourceDate);
    const stations = parseDay(week?.days?.find((d) => d.date === sourceDate)?.menu_items ?? []);
    if (!Object.keys(stations).length) return false;
    // Two menu types can land on the same tab (e.g. "lunch" and "lunch-buffet"): merge their stations.
    result[targetDate][display][meal] = { ...result[targetDate][display][meal], ...stations };
    return true;
  };

  await Promise.all(
    Object.entries(LOCATIONS).flatMap(([slug, display]) =>
      typesFor(slug, display).flatMap(({ menuType, meal }) =>
        dates.map((date) => fill(slug, display, menuType, meal, date, date)),
      ),
    ),
  );

  // Weekly-repeating locations: their latest posted week is the menu every week. Any day/meal in the window
  // without a posted menu gets the same weekday from that week (Monday's menu on every Monday).
  await Promise.all(
    Object.entries(LOCATIONS)
      .filter(([slug]) => REPEATS_WEEKLY.has(slug))
      .map(async ([slug, display]) => {
        const types = typesFor(slug, display);
        const posted = new Set(dates.flatMap((d) => Object.keys(result[d][display]).map((meal) => `${d}/${meal}`)));
        for (let back = 1; back <= LOOKBACK_WEEKS; back++) {
          const templateSunday = sundayOf(addDays(dates[0], -7 * back));
          const weeks = await Promise.all(
            types.map(({ menuType }) => fetchWeek(slug, display, menuType, templateSunday)),
          );
          if (!weeks.some((w) => w?.days?.some((d) => (d.menu_items ?? []).some((x) => x.food?.name)))) continue;
          await Promise.all(
            types.flatMap(({ menuType, meal }) =>
              dates
                .filter((d) => !posted.has(`${d}/${meal}`))
                .map((d) => fill(slug, display, menuType, meal, addDays(templateSunday, weekday(d)), d)),
            ),
          );
          return;
        }
      }),
  );

  return {
    generated_at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    source: BASE_API.replace("https://", ""),
    mode: "live",
    dates: result,
  };
}
