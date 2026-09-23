import type { DayMenu, MenuItem } from "./types";

export type SearchRow = {
  location: string;
  meal: string;
  station: string;
  item: MenuItem;
  /** true when only the station name matched */
  stationMatch: boolean;
};

export function searchDay(day: DayMenu | undefined, query: string): SearchRow[] {
  const q = query.trim().toLowerCase();
  if (!day || !q) return [];
  const byName: SearchRow[] = [];
  const byStation: SearchRow[] = [];
  for (const [location, meals] of Object.entries(day)) {
    for (const [meal, stations] of Object.entries(meals)) {
      for (const [station, items] of Object.entries(stations)) {
        const stationHit = station.toLowerCase().includes(q);
        for (const item of items) {
          if (item.name.toLowerCase().includes(q)) {
            byName.push({ location, meal, station, item, stationMatch: false });
          } else if (stationHit) {
            byStation.push({ location, meal, station, item, stationMatch: true });
          }
        }
      }
    }
  }
  return [...byName, ...byStation];
}
