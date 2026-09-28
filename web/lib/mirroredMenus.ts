import { HALLS } from "./halls";
import { dowOf } from "./hours";
import type { MenuData } from "./types";

// Nutrislice never posts breakfast for Soper Commons, even though Commons serves
// breakfast whenever it's open for it. Commons' breakfast is identical to McEwen's,
// which IS posted correctly, so mirror McEwen's actual daily breakfast over whenever
// Commons has nothing posted for that date.

const MIRRORS = [{ meal: "Breakfast", from: "mcewen", to: "commons" }];

/**
 * Copy another hall's actually-posted menu into a hall/meal on dates it's missing.
 * Posted menus always win; this only fills a genuine gap.
 */
export function withMirroredMenus(data: MenuData): MenuData {
  const dates = structuredClone(data.dates);
  for (const { meal, from, to } of MIRRORS) {
    const fromHall = HALLS.find((h) => h.slug === from);
    const toHall = HALLS.find((h) => h.slug === to);
    if (!fromHall || !toHall) continue;
    for (const [date, day] of Object.entries(dates)) {
      const open = toHall.hours[dowOf(date)];
      if (!open.some((p) => p.meal === meal)) continue;
      const toLoc = (day[toHall.name] ??= {});
      if (Object.keys(toLoc[meal] ?? {}).length) continue;
      const fromMenu = day[fromHall.name]?.[meal];
      if (fromMenu && Object.keys(fromMenu).length) toLoc[meal] = structuredClone(fromMenu);
    }
  }
  return { ...data, dates };
}
