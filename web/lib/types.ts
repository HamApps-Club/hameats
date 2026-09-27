export type Nutrition = {
  protein?: number;
  carbs?: number;
  fat?: number;
  sugar?: number;
  fiber?: number;
  sodium?: number;
};

export type MenuItem = {
  name: string;
  calories: number | null;
  tags: string[];
  /** Extra detail from the full weeks API; absent in older saved menus. */
  description?: string;
  serving?: string;
  ingredients?: string;
  nutrition?: Nutrition;
};

/** station -> items */
export type MealMenu = Record<string, MenuItem[]>;
/** meal ("Breakfast" | "Lunch" | "Dinner") -> stations */
export type LocationMenu = Record<string, MealMenu>;
/** location display name -> meals */
export type DayMenu = Record<string, LocationMenu>;

export type MenuData = {
  generated_at: string;
  source: string;
  mode?: string;
  /** "YYYY-MM-DD" -> locations */
  dates: Record<string, DayMenu>;
};

export const MEALS = ["Breakfast", "Lunch", "Dinner"] as const;
export type Meal = (typeof MEALS)[number];

export const LOCATIONS = ["Soper Commons", "McEwen Dining Hall", "Howard Diner", "Little Pub"] as const;
