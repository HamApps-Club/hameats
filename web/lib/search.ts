import type { MenuData, MenuItem } from "./types";

export type SearchRow = {
  date: string;
  location: string;
  meal: string;
  station: string;
  item: MenuItem;
  /** true when only the station name matched */
  stationMatch: boolean;
};

/** Search the given dates; exact food-name matches come before station-name matches. */
export function searchMenus(data: MenuData | null, dates: string[], query: string): SearchRow[] {
  const q = query.trim().toLowerCase();
  if (!data || !q) return [];
  const byName: SearchRow[] = [];
  const byStation: SearchRow[] = [];
  for (const date of dates) {
    for (const [location, meals] of Object.entries(data.dates[date] ?? {})) {
      for (const [meal, stations] of Object.entries(meals)) {
        for (const [station, items] of Object.entries(stations)) {
          const stationHit = station.toLowerCase().includes(q);
          for (const item of items) {
            if (item.name.toLowerCase().includes(q)) {
              byName.push({ date, location, meal, station, item, stationMatch: false });
            } else if (stationHit) {
              byStation.push({ date, location, meal, station, item, stationMatch: true });
            }
          }
        }
      }
    }
  }
  return [...byName, ...byStation];
}
