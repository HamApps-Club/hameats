"use client";

import { MEALS, type Meal } from "@/lib/types";

/**
 * The header shared by the meal-first layouts (Comparison, Allergen Filter): TigerMenus' jumbotron,
 * a light grey band with a big -1px-tracked title and a plain-text Breakfast/Lunch/Dinner nav.
 */
export function MealHeader({ meal, onSelectMeal }: { meal: Meal; onSelectMeal: (meal: Meal) => void }) {
  return (
    <header
      className="border-b border-[#e1e5e8] bg-[#eeeeee] px-4 pb-6 pt-8 text-center dark:border-zinc-800 dark:bg-zinc-900"
      // Bootstrap 3's default stack, which TigerMenus never overrides.
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      <h1 className="text-[40px] font-medium tracking-[-1px] text-[#262626] dark:text-zinc-100">
        <span className="text-accent">Ham</span> Eats
      </h1>
      <div role="tablist" aria-label="Meal" className="mt-2 flex justify-center gap-4 text-lg">
        {MEALS.map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={m === meal}
            onClick={() => onSelectMeal(m)}
            className={`min-h-11 px-1 ${
              m === meal ? "font-bold text-accent" : "text-[#262626] hover:underline dark:text-zinc-300"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </header>
  );
}
