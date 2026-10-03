import { HALLS } from "./halls";
import { dowOf } from "./hours";
import type { MealMenu, MenuData } from "./types";
import commonsBreakfast from "./commonsBreakfast.json";

// The menu source never posts breakfast for Soper Commons, even though Commons serves
// breakfast whenever it's open for it. Commons' breakfast is identical to McEwen's,
// which IS posted correctly, so mirror McEwen's actual daily breakfast over whenever
// Commons has nothing posted for that date. On days McEwen posts no breakfast (weekends),
// Commons gets McEwen's standard weekday breakfast, hard-coded in commonsBreakfast.json.

const MIRRORS: { meal: string; from: string; to: string; fallback: MealMenu }[] = [
  { meal: "Breakfast", from: "mcewen", to: "commons", fallback: commonsBreakfast },
];

/**
 * Copy another hall's actually-posted menu into a hall/meal on dates it's missing.
 * Posted menus always win; this only fills a genuine gap.
 */
export function withMirroredMenus(data: MenuData): MenuData {
  const dates = structuredClone(data.dates);
  for (const { meal, from, to, fallback } of MIRRORS) {
    const fromHall = HALLS.find((h) => h.slug === from);
    const toHall = HALLS.find((h) => h.slug === to);
    if (!fromHall || !toHall) continue;
    for (const [date, day] of Object.entries(dates)) {
      const open = toHall.hours[dowOf(date)];
      if (!open.some((p) => p.meal === meal)) continue;
      const toLoc = (day[toHall.name] ??= {});
      if (Object.keys(toLoc[meal] ?? {}).length) continue;
      const fromMenu = day[fromHall.name]?.[meal];
      toLoc[meal] = structuredClone(fromMenu && Object.keys(fromMenu).length ? fromMenu : fallback);
    }
  }
  return { ...data, dates };
}
