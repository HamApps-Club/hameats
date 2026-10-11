import { HALLS } from "./halls";
import type { Meal, MenuData, MenuItem } from "./types";

// One-off dishes a hall is serving that Nutrislice didn't list. Add one line per dish:
//
//   special("2026-09-28", "commons", "Dinner", "Oven", "Mac and Cheese", ["Vegetarian", "Dairy", "Wheat"]),
//
//   date     YYYY-MM-DD, the day it's served (entries for past days are simply ignored)
//   hall     "commons" | "mcewen" | "diner" | "little-pub"
//   meal     "Breakfast" | "Lunch" | "Dinner"
//   station  the station heading it goes under (a new heading is made if the station isn't on the menu)
//   tags     optional allergen/diet tags, named as Nutrislice names them (they drive the allergen filter)
//   description  optional, shown when the dish is tapped
//
// Specials appear alongside the posted menu, never twice if Nutrislice later lists the same dish.
// Nutrislice has no nutrition data for them, so calories show as "—".

type Special = { date: string; hall: string; meal: Meal; station: string; item: MenuItem };

const special = (
  date: string,
  hall: string,
  meal: Meal,
  station: string,
  name: string,
  tags: string[] = [],
  description?: string,
): Special => ({
  date,
  hall,
  meal,
  station,
  item: { name, calories: null, tags, ...(description ? { description } : {}) },
});

const SPECIALS: Special[] = [
  special("2026-09-28", "commons", "Dinner", "Oven", "Mac and Cheese", ["Vegetarian", "Dairy", "Wheat"]),
  special("2026-09-28", "commons", "Dinner", "Bravo", "Loaded Baked Potato", ["Dairy", "Pork", "Gluten Friendly"],
    "Baked potato with cheese, bacon, sour cream and scallions."),
  special("2026-10-05", "commons", "Lunch", "Bravo", "Make Your Own Drumsticks"),
  special("2026-10-11", "commons", "Dinner", "Spoon & Fork", "Chicken Stir Fry"),
];

/** Add each special to its hall, meal and station on its date. */
export function withSpecials(data: MenuData): MenuData {
  const dates = structuredClone(data.dates);
  for (const { date, hall: slug, meal, station, item } of SPECIALS) {
    const hall = HALLS.find((h) => h.slug === slug);
    const day = dates[date];
    if (!hall || !day) continue;
    const items = (((day[hall.name] ??= {})[meal] ??= {})[station] ??= []);
    if (!items.some((i) => i.name.toLowerCase() === item.name.toLowerCase())) items.push(item);
  }
  return { ...data, dates };
}
