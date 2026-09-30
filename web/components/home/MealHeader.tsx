"use client";

import { DayPicker } from "@/components/DayPicker";
import { MEALS, type Meal } from "@/lib/types";

// Bootstrap 3's default stack, which TigerMenus never overrides.
const SITE_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

/**
 * The header shared by the meal-first layouts (Comparison, Allergen Filter): TigerMenus' jumbotron,
 * a light grey band with a big -1px-tracked title and the day-of-week picker underneath.
 */
export function MealHeader({
  dates,
  selected,
  today,
  onSelectDate,
  isDimmed,
}: {
  dates: string[];
  selected: string | undefined;
  today: string;
  onSelectDate: (date: string) => void;
  isDimmed?: (date: string) => boolean;
}) {
  return (
    <header
      className="border-b border-[#e1e5e8] bg-[#eeeeee] px-4 pb-6 pt-8 text-center dark:border-zinc-800 dark:bg-zinc-900"
      style={{ fontFamily: SITE_FONT }}
    >
      <h1 className="text-[40px] font-medium tracking-[-1px] text-[#262626] dark:text-zinc-100">
        <span className="text-accent">Ham</span> Eats
      </h1>
      <div className="mx-auto mt-4 max-w-2xl">
        <DayPicker dates={dates} selected={selected} today={today} onSelect={onSelectDate} isDimmed={isDimmed} />
      </div>
    </header>
  );
}

/**
 * The Breakfast/Lunch/Dinner switcher, shown as a white bar below the header
 * (in the day picker's old spot) so it stands out against the page background.
 */
export function MealTabsBar({ meal, onSelectMeal }: { meal: Meal; onSelectMeal: (meal: Meal) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Meal"
      className="mx-auto flex max-w-2xl justify-center gap-4 rounded-2xl border border-zinc-200 bg-white py-3 text-lg shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      style={{ fontFamily: SITE_FONT }}
    >
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
  );
}
