/** Grams unless the name says otherwise. */
export type Nutrition = {
  protein?: number;
  carbs?: number;
  fat?: number;
  saturatedFat?: number;
  transFat?: number;
  cholesterolMg?: number;
  sodium?: number;
  fiber?: number;
  sugar?: number;
  addedSugar?: number;
  potassiumMg?: number;
  calciumMg?: number;
  ironMg?: number;
  vitaminDMcg?: number;
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
  /** Locations showing a repeated older menu because nothing is posted yet: location -> Sunday of that week. */
  reused?: Record<string, string>;
};

export const MEALS = ["Breakfast", "Lunch", "Dinner"] as const;
export type Meal = (typeof MEALS)[number];

export const LOCATIONS = ["Soper Commons", "McEwen Dining Hall", "Howard Diner", "Little Pub"] as const;
