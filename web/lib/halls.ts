import { HOURS, type WeekHours } from "./hours";
import type { Meal, MealMenu, MenuData } from "./types";

export type Hall = {
  slug: string;
  /** Location name as it appears in the menu data. */
  name: string;
  hours: WeekHours;
  /** Stations shown first, in this order; the rest keep the menu's order. */
  stationOrder?: string[];
  /** Stations left off the app entirely, even when the menu source posts them. */
  hiddenStations?: string[];
  /** Menu tabs to show, when not every meal in `hours` has a menu (Little Pub's pub nights have none). */
  menuMeals?: Meal[];
};

export const HALLS: Hall[] = [
  {
    slug: "commons",
    name: "Soper Commons",
    hours: HOURS.commons,
    stationOrder: ["Spoon & Fork", "Inspired Eats", "Fresh Stock", "V2", "Grill", "Bravo"],
    hiddenStations: ["Oven"],
  },
  {
    slug: "mcewen",
    name: "McEwen Dining Hall",
    hours: HOURS.mcewen,
    stationOrder: ["Spoon & Fork", "Inspired Eats", "Fresh Stock", "V2", "Grill", "Bravo"],
    hiddenStations: ["Oven"],
  },
  { slug: "diner", name: "Howard Diner", hours: HOURS.diner },
  { slug: "little-pub", name: "Little Pub", hours: HOURS.littlePub, menuMeals: ["Lunch"] },
];

export const hallBySlug = (slug: string) => HALLS.find((h) => h.slug === slug);

/** Drop each hall's hidden stations (the pizza Oven) from every date and meal. */
export function withoutHiddenStations(data: MenuData): MenuData {
  const dates = structuredClone(data.dates);
  for (const day of Object.values(dates))
    for (const { name, hiddenStations = [] } of HALLS)
      for (const menu of Object.values(day[name] ?? {}))
        for (const station of hiddenStations) delete menu[station];
  return { ...data, dates };
}

/** Stations whose foods are an entree plus sides, so the main protein is listed first. */
const ENTREE_STATIONS = new Set(["Spoon & Fork", "Inspired Eats", "Grill"]);
const MEAT = /\b(chicken|beef|pork|turkey|ham|bacon|sausage|steak|meatballs?|lamb|fish|salmon|cod|tuna|shrimp|burger|brisket|ribs?)\b/i;
const PLANT_PROTEIN = /\b(tofu|tempeh|seitan|chickpeas?|lentils?|beans?|falafel|eggs?)\b/i;
// Meat-style names that are vegetarian ("Garden Burger", "Vegetarian Breakfast Sausage Patty").
const MEATLESS = /\b(garden|veggie|vegetarian|vegan|plant)\b/i;
// A dish that only has a protein in its name, not the main course ("Chicken Rice Pilaf", "Bean Salad").
const SIDE = /\b(couscous|pilaf|vegetables?|potatoes?|fries|salad|soup|chowder|sauce|gravy|pasta|bread|roll|slaw)\b/i;

/** 0 = meat or fish main, 1 = vegetarian protein (plant-based, eggs), 2 = everything else (sides keep the menu's order). */
function proteinRank(name: string) {
  if (SIDE.test(name)) return 2;
  if (MEATLESS.test(name)) return 1;
  if (MEAT.test(name)) return 0;
  if (PLANT_PROTEIN.test(name)) return 1;
  return 2;
}

export function orderedStations(stations: MealMenu | undefined, order: string[] = []) {
  const entries = stations ? Object.entries(stations) : [];
  const rank = (s: string) => (order.includes(s) ? order.indexOf(s) : order.length);
  // Array.prototype.sort is stable, so unlisted stations keep their original order.
  return entries
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([station, items]): [string, typeof items] => [
      station,
      ENTREE_STATIONS.has(station) ? [...items].sort((a, b) => proteinRank(a.name) - proteinRank(b.name)) : items,
    ]);
}
