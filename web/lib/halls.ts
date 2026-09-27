import { HOURS, type WeekHours } from "./hours";
import type { MealMenu } from "./types";

export type Hall = {
  slug: string;
  /** Location name as it appears in the menu data. */
  name: string;
  hours: WeekHours;
  /** Stations shown first, in this order; the rest keep the menu's order. */
  stationOrder?: string[];
};

export const HALLS: Hall[] = [
  { slug: "commons", name: "Soper Commons", hours: HOURS.commons, stationOrder: ["Spoon & Fork", "Inspired Eats"] },
  { slug: "mcewen", name: "McEwen Dining Hall", hours: HOURS.mcewen, stationOrder: ["Spoon & Fork", "Fresh Stock"] },
  { slug: "diner", name: "Howard Diner", hours: HOURS.diner },
];

export const hallBySlug = (slug: string) => HALLS.find((h) => h.slug === slug);

export function orderedStations(stations: MealMenu | undefined, order: string[] = []) {
  const entries = stations ? Object.entries(stations) : [];
  const rank = (s: string) => (order.includes(s) ? order.indexOf(s) : order.length);
  // Array.prototype.sort is stable, so unlisted stations keep their original order.
  return entries.sort(([a], [b]) => rank(a) - rank(b));
}
