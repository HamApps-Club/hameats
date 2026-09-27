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

/** Hamilton College's Continental Blue and Buff (colors defined in globals.css), used by every page. */
export const THEME: HallTheme = {
  accentText: "text-continental dark:text-buff",
  selected: "border-buff bg-buff text-continental-dark",
  header: "border-buff bg-continental/95",
  headerTitle: "text-buff",
  card: "border-buff-light border-l-4 border-l-buff bg-white dark:border-continental dark:border-l-buff dark:bg-continental-dark/50",
  page: "bg-buff-50 dark:bg-slate-950",
  button: "border-buff bg-continental text-white hover:bg-continental-dark",
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
