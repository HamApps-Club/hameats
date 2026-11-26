import { HALLS } from "./halls";
import { dayHours } from "./hours";
import type { MealMenu, MenuData, MenuItem } from "./types";

// Menus that don't change day to day. The posted menus have no item data for these, so they're transcribed
// from the posted PDF (public/menus/howard-diner.pdf). Tags use the PDF's icons, named the way the posted
// menus name them. Update this file when the Diner posts a new menu.

const item = (name: string, description: string | undefined, tags: string[]): MenuItem => ({
  name,
  calories: null,
  tags,
  ...(description ? { description } : {}),
});

const DINER_BREAKFAST: MealMenu = {
  "Breakfast Sandwiches": [
    item("Bacon Egg & Cheese on a Bagel", "Your choice of a plain or everything bagel.", ["Pork", "Wheat", "Dairy", "Egg", "Sesame", "Soy"]),
    item("Sausage Egg & Cheese on a Bagel", "Your choice of a plain or everything bagel.", ["Pork", "Wheat", "Dairy", "Egg", "Sesame", "Soy"]),
    item("Toasted Bagel with Cream Cheese", undefined, ["Wheat", "Dairy", "Egg", "Sesame", "Soy"]),
  ],
  "Plates & Sides": [
    item("Diner Mess", "Egg, bacon, tater tots and cheese all mixed together with toast on the side.", ["Pork", "Wheat", "Dairy", "Egg", "Sesame", "Soy"]),
    item("Pancakes & Syrup", undefined, ["Wheat", "Dairy"]),
    item("Tater Tots", undefined, ["Wheat", "Soy"]),
  ],
};

const DINER_ALL_DAY: MealMenu = {
  Burgers: [
    item("Classic Cheeseburger", "Classic beef patty, American cheese, lettuce, tomato, onion, and pickles on a classic bun.", ["Sesame", "Soy", "Dairy", "Wheat"]),
    item("Hamburger", "Classic beef patty, lettuce, tomato, onion, and pickles on a classic bun.", ["Sesame", "Soy", "Wheat"]),
    item("Beyond Burger", "Something for everyone. Vegan burger patty, lettuce, tomato, onion, and pickles on a classic bun.", ["Vegan", "Sesame", "Soy", "Wheat", "Tree Nut"]),
  ],
  "Sandwiches & Subs": [
    item("Parm Sandwich", "Crispy chicken, homemade marinara sauce, and melted provolone cheese.", ["Sesame", "Soy", "Dairy", "Wheat"]),
    item("Philly Sub", "Grilled steak, grilled onions, peppers & onions, and provolone cheese.", ["Sesame", "Soy", "Dairy", "Wheat"]),
    item("Black Russian", "Ham, turkey, Swiss cheese, lettuce, and tomato with pesto mayo, pressed on a panini press.", ["Soy", "Dairy", "Wheat", "Egg", "Pork"]),
    item("Tuscan Chicken Sandwich", undefined, []),
  ],
  Wraps: [
    item("Buffalo Chicken Wrap", "Crispy chicken, lettuce, tomato, and Frank's Red Hot Sauce on a tortilla wrap.", ["Dairy", "Soy", "Wheat"]),
    item("Chicken Caesar Wrap", "Fried chicken, romaine lettuce, Parmesan cheese, handmade croutons and Caesar dressing (grilled chicken available by request).", ["Dairy", "Soy", "Wheat", "Egg"]),
    item("El Guapo", "Avocado, cucumbers, tomato, lettuce, and crispy chicken with chipotle ranch dressing.", ["Soy", "Dairy", "Wheat", "Egg"]),
    item("Mediterranean Veggie Wrap", "Hummus, red pepper, kalamata olives, red onion, eggplant with a sprinkle of feta cheese.", ["Vegetarian", "Dairy", "Wheat"]),
  ],
  Salads: [
    item("Chef Salad", "Lettuce, cucumber, tomato, Swiss cheese, onion, ham, and turkey with choice of dressing.", ["Dairy", "Pork"]),
  ],
  "Baskets & Sides": [
    item("Chicken Fingers", undefined, ["Soy", "Wheat"]),
    item("French Fries", undefined, ["Soy", "Wheat"]),
  ],
};

export type StandingMenu = {
  /** Hall slug (see halls.ts). */
  slug: string;
  meals: Partial<Record<"Breakfast" | "Lunch" | "Dinner", MealMenu>>;
  /** Shown above the menu, e.g. pricing. */
  note: string;
  pdf: string;
  /**
   * Show this menu every day, even when the posted menu has something for the hall. The Diner's menu never changes,
   * but the posted menu lists a few daily items for it (soup, a sandwich, macaroni salad) that would otherwise
   * replace the whole menu on those days.
   */
  always?: boolean;
};

export const STANDING_MENUS: StandingMenu[] = [
  {
    slug: "diner",
    meals: { Breakfast: DINER_BREAKFAST, Lunch: DINER_ALL_DAY, Dinner: DINER_ALL_DAY },
    note: "Meal swipe combo: entrée, side of fries, and a small beverage. À la carte: breakfast (staff) $7.17 · staff combo $9.55 · visitor meal $12.50 · iced coffee $4.50 (tax not included).",
    pdf: "/menus/howard-diner.pdf",
    always: true,
  },
];

export const standingMenuFor = (slug: string) => STANDING_MENUS.find((m) => m.slug === slug);

/**
 * Fill in each standing menu on the days and meals its hall is open. Wherever a menu was posted, the
 * posted menu wins, except for a standing menu marked `always`, which replaces it.
 */
export function withStandingMenus(data: MenuData): MenuData {
  const dates = structuredClone(data.dates);
  for (const standing of STANDING_MENUS) {
    const hall = HALLS.find((h) => h.slug === standing.slug);
    if (!hall) continue;
    for (const [date, day] of Object.entries(dates)) {
      const open = dayHours(hall.hours, date);
      const loc = (day[hall.name] ??= {});
      for (const [meal, menu] of Object.entries(standing.meals)) {
        const served = open.some((p) => p.meal === meal);
        if (served && menu && (standing.always || !Object.keys(loc[meal] ?? {}).length)) loc[meal] = menu;
      }
      // An `always` menu is the hall's whole menu, so what was posted for a meal the hall isn't serving
      // that day (the Diner has no lunch on weekends) isn't shown either.
      if (standing.always)
        for (const meal of Object.keys(loc)) if (!open.some((p) => p.meal === meal)) delete loc[meal];
    }
  }
  return { ...data, dates };
}

/** True when this hall/meal is showing the standing menu rather than a posted one. */
export const isStanding = (slug: string, meal: string, stations: MealMenu | undefined) =>
  !!stations && standingMenuFor(slug)?.meals[meal as "Breakfast"] === stations;
