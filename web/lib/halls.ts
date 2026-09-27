import type { MealMenu } from "./types";

/** Tailwind class sets for a hall's color scheme (literal strings so Tailwind picks them up). */
export type HallTheme = {
  /** Station labels and other accent text. */
  accentText: string;
  /** Selected date chip / badges. */
  selected: string;
  /** Page header bar. */
  header: string;
  /** Title text inside the header. */
  headerTitle: string;
  /** Station card border. */
  card: string;
  /** Page background. */
  page: string;
  /** Home screen button for this hall. */
  button: string;
};

export type Hall = {
  slug: string;
  name: string;
  short: string;
  theme: HallTheme;
  /** Stations shown first, in this order; the rest keep the menu's order. */
  stationOrder?: string[];
};

/** Blue and yellow, used by every page. */
export const THEME: HallTheme = {
  accentText: "text-blue-800 dark:text-yellow-300",
  selected: "border-yellow-400 bg-yellow-400 text-blue-950",
  header: "border-yellow-400 bg-blue-900/95",
  headerTitle: "text-yellow-300",
  card: "border-blue-200 border-l-4 border-l-yellow-400 bg-white dark:border-blue-900 dark:border-l-yellow-400 dark:bg-blue-950/60",
  page: "bg-blue-50 dark:bg-slate-950",
  button: "border-yellow-400 bg-blue-900 text-yellow-300 hover:bg-blue-800",
};

export const HALLS: Hall[] = [
  { slug: "commons", name: "Soper Commons", short: "Commons", theme: THEME, stationOrder: ["Spoon & Fork", "Inspired Eats"] },
  { slug: "mcewen", name: "McEwen Dining Hall", short: "McEwen", theme: THEME, stationOrder: ["Spoon & Fork", "Fresh Stock"] },
  { slug: "diner", name: "Howard Diner", short: "Diner", theme: THEME },
];

export const hallBySlug = (slug: string) => HALLS.find((h) => h.slug === slug);

export function orderedStations(stations: MealMenu | undefined, order: string[] = []) {
  const entries = stations ? Object.entries(stations) : [];
  const rank = (s: string) => (order.includes(s) ? order.indexOf(s) : order.length);
  // Array.prototype.sort is stable, so unlisted stations keep their original order.
  return entries.sort(([a], [b]) => rank(a) - rank(b));
}
