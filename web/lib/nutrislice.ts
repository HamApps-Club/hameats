import type { MealMenu, MenuData, MenuItem, Nutrition } from "./types";

// Server-side port of scraper/scrape_menu.py (api mode). Keep the two in sync.

const BASE_API = "https://hamiltoncollege.api.nutrislice.com";
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

/** Plain text from a Nutrislice rich-text field (may contain HTML). */
const plain = (s: string | null | undefined) =>
  (s ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim() || undefined;

const NUTRIENTS: [keyof Nutrition, string][] = [
  ["protein", "g_protein"],
  ["carbs", "g_carbs"],
  ["fat", "g_fat"],
  ["sugar", "g_sugar"],
  ["fiber", "g_fiber"],
  ["sodium", "mg_sodium"],
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
      serving: size?.serving_size_amount ? `${size.serving_size_amount} ${size.serving_size_unit ?? ""}`.trim() : undefined,
      ingredients: plain(food?.ingredients),
      nutrition: nutritionOf(food?.rounded_nutrition_info),
    };
    bucket.push(item);
  }
  return Object.fromEntries(Object.entries(stations).filter(([, v]) => v.length));
}

async function servedMeals(revalidate: number): Promise<Record<string, string[]>> {
  try {
    const schools = await getJson<ApiSchool[]>(`${BASE_API}/menu/api/schools/?format=json`, revalidate);
    return Object.fromEntries(
      schools
        .filter((s) => s.slug in LOCATIONS)
        .map((s) => [s.slug, (s.active_menu_types ?? []).map((m) => m.slug).filter((m) => MEALS.includes(m))]),
    );
  } catch {
    return {};
  }
}

export function countItems(data: MenuData) {
  let n = 0;
  for (const day of Object.values(data.dates))
    for (const loc of Object.values(day))
      for (const meal of Object.values(loc)) for (const items of Object.values(meal)) n += items.length;
  return n;
}

/** Fetch the next `days` days of menus for every hall, straight from Nutrislice. */
export async function fetchMenus(days = 7, revalidate = 1800): Promise<MenuData> {
  const start = hamiltonToday();
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const result: MenuData["dates"] = Object.fromEntries(
    dates.map((d) => [d, Object.fromEntries(Object.values(LOCATIONS).map((name) => [name, {}]))]),
  );
  const mealsByLoc = await servedMeals(revalidate);

  const jobs = Object.entries(LOCATIONS).flatMap(([slug, display]) =>
    (mealsByLoc[slug] ?? MEALS).map(async (meal) => {
      // Each weeks response covers a Sunday–Saturday week, so one request serves every date inside it.
      const weeks: ApiWeek[] = [];
      for (const date of dates) {
        let week = weeks.find((w) => w.days?.some((d) => d.date === date));
        if (!week) {
          // Full weeks endpoint (not the digest), in the form .../2026/9/23; JSON comes back via the Accept header.
          const [y, m, d] = date.split("-").map(Number);
          const url = `${BASE_API}/menu/api/weeks/school/${slug}/menu-type/${meal}/${y}/${m}/${d}`;
          try {
            week = await getJson<ApiWeek>(url, revalidate);
          } catch (e) {
            console.error(`menu fetch failed: ${display} / ${meal} / ${date}:`, e);
            continue;
          }
          weeks.push(week);
        }
        const day = week.days?.find((d) => d.date === date);
        const stations = parseDay(day?.menu_items ?? []);
        if (Object.keys(stations).length) {
          result[date][display][meal[0].toUpperCase() + meal.slice(1)] = stations;
        }
      }
    }),
  );
  await Promise.all(jobs);

  return {
    generated_at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    source: BASE_API.replace("https://", ""),
    mode: "live",
    dates: result,
  };
}
