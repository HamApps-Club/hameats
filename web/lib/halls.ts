import { HOURS, type WeekHours } from "./hours";
import type { Meal, MealMenu } from "./types";

export type Hall = {
  slug: string;
  /** Location name as it appears in the menu data. */
  name: string;
  hours: WeekHours;
  /** Stations shown first, in this order; the rest keep the menu's order. */
  stationOrder?: string[];
  /**
   * Orders every station's foods, lowest first (ties keep the menu's order), for halls whose menu isn't split into
   * entree stations: the Little Pub lists all its foods in one.
   */
  itemRank?: (name: string) => number;
  /** Menu tabs to show, when not every meal in `hours` has a menu (Little Pub's pub nights have none). */
  menuMeals?: Meal[];
};

// The Little Pub lists everything in one station: pizza every day, the day's featured food (wings, riggies, mac and
// cheese...), and its sides, salads and taco toppings. The featured food is the main, so it goes first.
const PUB_PIZZA = /\bpizza\b/i;
const PUB_SIDE =
  /\b(salads?|coleslaw|slaw|fries|potato(es)?|wedges|tots|chips|bread(sticks?)?|rice|guacamole|salsa|sour cream|lettuce|cheddar jack|dressing)\b/i;

/** 0 = the featured main, 1 = pizza, 2 = sides, salads and toppings. */
function pubRank(name: string) {
  if (PUB_PIZZA.test(name)) return 1;
  if (PUB_SIDE.test(name)) return 2;
  return 0;
}

export const HALLS: Hall[] = [
  {
    slug: "commons",
    name: "Soper Commons",
    hours: HOURS.commons,
    stationOrder: ["Spoon & Fork", "Inspired Eats", "Fresh Stock", "V2", "Grill", "Bravo", "Oven"],
  },
  {
    slug: "mcewen",
    name: "McEwen Dining Hall",
    hours: HOURS.mcewen,
    stationOrder: ["Spoon & Fork", "Inspired Eats", "Fresh Stock", "V2", "Grill", "Bravo", "Oven"],
  },
  { slug: "diner", name: "Howard Diner", hours: HOURS.diner },
  { slug: "little-pub", name: "Little Pub", hours: HOURS.littlePub, menuMeals: ["Lunch"], itemRank: pubRank },
];

export const hallBySlug = (slug: string) => HALLS.find((h) => h.slug === slug);

/** Stations whose foods are an entree plus sides, so the main protein is listed first. */
const ENTREE_STATIONS = new Set(["Spoon & Fork", "Inspired Eats", "Grill"]);
const MEAT = /\b(chicken|beef|pork|turkey|ham|bacon|sausage|steak|meatballs?|lamb|fish|salmon|cod|haddock|tilapia|trout|catfish|pollock|mahi|swordfish|scallops?|tuna|shrimp|burger|brisket|ribs?)\b/i;
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

export function orderedStations(
  stations: MealMenu | undefined,
  order: string[] = [],
  itemRank?: (name: string) => number,
) {
  const entries = stations ? Object.entries(stations) : [];
  const rank = (s: string) => (order.includes(s) ? order.indexOf(s) : order.length);
  // Array.prototype.sort is stable, so unlisted stations keep their original order.
  return entries
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([station, items]): [string, typeof items] => [
      station,
      itemRank
        ? [...items].sort((a, b) => itemRank(a.name) - itemRank(b.name))
        : ENTREE_STATIONS.has(station)
          ? [...items].sort((a, b) => proteinRank(a.name) - proteinRank(b.name))
          : items,
    ]);
}
