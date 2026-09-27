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

const DEFAULT_THEME: HallTheme = {
  accentText: "text-red-800 dark:text-red-400",
  selected: "border-red-800 bg-red-800 text-white dark:border-red-500 dark:bg-red-600",
  header: "border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-950/90",
  headerTitle: "",
  card: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
  page: "bg-zinc-50 dark:bg-zinc-950",
  button:
    "border-red-800 bg-white text-red-900 hover:bg-red-50 dark:border-red-500 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-zinc-800",
};

const COMMONS_THEME: HallTheme = {
  accentText: "text-blue-800 dark:text-yellow-300",
  selected: "border-yellow-400 bg-yellow-400 text-blue-950",
  header: "border-yellow-400 bg-blue-900/95",
  headerTitle: "text-yellow-300",
  card: "border-blue-200 border-l-4 border-l-yellow-400 bg-white dark:border-blue-900 dark:border-l-yellow-400 dark:bg-blue-950/60",
  page: "bg-blue-50 dark:bg-slate-950",
  button: "border-yellow-400 bg-blue-900 text-yellow-300 hover:bg-blue-800",
};

export const HALLS: Hall[] = [
  { slug: "commons", name: "Soper Commons", short: "Commons", theme: COMMONS_THEME, stationOrder: ["Spoon & Fork", "Inspired Eats"] },
  { slug: "mcewen", name: "McEwen Dining Hall", short: "McEwen", theme: DEFAULT_THEME },
  { slug: "diner", name: "Howard Diner", short: "Diner", theme: DEFAULT_THEME },
];

export { DEFAULT_THEME };

export const hallBySlug = (slug: string) => HALLS.find((h) => h.slug === slug);

export function orderedStations(stations: MealMenu | undefined, order: string[] = []) {
  const entries = stations ? Object.entries(stations) : [];
  const rank = (s: string) => (order.includes(s) ? order.indexOf(s) : order.length);
  // Array.prototype.sort is stable, so unlisted stations keep their original order.
  return entries.sort(([a], [b]) => rank(a) - rank(b));
}
