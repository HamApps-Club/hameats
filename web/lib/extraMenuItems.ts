import { HALLS } from "./halls";
import { dowOf } from "./hours";
import type { MenuData, MenuItem } from "./types";

// Items a hall serves every day that Nutrislice doesn't list. Each is added to its station
// for every listed meal the hall is open, alongside whatever Nutrislice posted. Nutrislice has
// no nutrition data for these, so calories stay empty; tags are the usual allergens for the dish.

type ExtraItem = { hall: string; meals: string[]; station: string; item: MenuItem };

const EXTRAS: ExtraItem[] = [
  {
    hall: "commons",
    meals: ["Lunch", "Dinner"],
    station: "Oven",
    item: { name: "Mac and Cheese", calories: null, tags: ["Vegetarian", "Dairy", "Wheat"] },
  },
  {
    hall: "commons",
    meals: ["Lunch", "Dinner"],
    station: "Bravo",
    item: {
      name: "Loaded Baked Potato",
      calories: null,
      tags: ["Dairy", "Pork", "Gluten Friendly"],
      description: "Baked potato with cheese, bacon, sour cream and scallions.",
    },
  },
];

/** Add each extra item to its hall's station on the days and meals the hall is open (never twice). */
export function withExtraMenuItems(data: MenuData): MenuData {
  const dates = structuredClone(data.dates);
  for (const { hall: slug, meals, station, item } of EXTRAS) {
    const hall = HALLS.find((h) => h.slug === slug);
    if (!hall) continue;
    for (const [date, day] of Object.entries(dates)) {
      const open = hall.hours[dowOf(date)];
      for (const meal of meals) {
        if (!open.some((p) => p.meal === meal)) continue;
        const items = (((day[hall.name] ??= {})[meal] ??= {})[station] ??= []);
        if (!items.some((i) => i.name.toLowerCase() === item.name.toLowerCase())) items.push(item);
      }
    }
  }
  return { ...data, dates };
}
