"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HALLS, type Hall } from "@/lib/halls";
import { compactRange, mealNow, statusAt, type CampusTime } from "@/lib/hours";
import type { HomeLayoutProps } from "@/lib/homeLayouts";
import { MEALS, type Meal, type MenuItem } from "@/lib/types";
import { ItemSheet } from "@/components/ItemSheet";
import { Tags } from "@/components/Tags";
import { track } from "@/lib/analytics";

/**
 * A fourth home layout inspired by Bowdoin Dining's "Net Nutrition" tool: the
 * same meal-first, no-search, no-click-navigation browsing as Meal First
 * (web/components/home/MealFirstHomeLayout.tsx), plus a filter panel that
 * narrows every hall's menu at once by allergen and dietary preference.
 */

// This app's actual tag vocabulary (see components/Tags.tsx), not the reference
// screenshot's wording — that reference is from a different school's data.
const ALLERGENS = ["Dairy", "Egg", "Fish", "Shellfish", "Pork", "Soy", "Wheat", "Sesame", "Tree Nut"] as const;
const PREFERENCES = ["Vegan", "Vegetarian", "Gluten Friendly", "Halal"] as const;

type Selected = { item: MenuItem; context: string };

function useItemSheet() {
  const [selected, setSelected] = useState<Selected | null>(null);
  useEffect(() => {
    const onPop = () => setSelected(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const open = useCallback((s: Selected) => {
    history.pushState({ itemSheet: true }, "");
    setSelected(s);
    track("item_opened", { item: s.item.name, context: s.context });
  }, []);
  const close = useCallback(() => {
    if (history.state?.itemSheet) history.back();
    else setSelected(null);
  }, []);
  const sheet = selected && <ItemSheet item={selected.item} context={selected.context} onClose={close} />;
  return { open, sheet };
}

function mealByClock(minutes: number): Meal {
  if (minutes < 10 * 60 + 30) return "Breakfast";
  if (minutes < 16 * 60) return "Lunch";
  return "Dinner";
}

function windowFor(hall: Hall, dow: number, meal: Meal) {
  return hall.hours[dow].find((p) => p.meal === meal);
}

/** Checking an allergen hides matching items; checking a preference keeps only items matching at least one. */
function itemPasses(item: MenuItem, excludeAllergens: Set<string>, requirePreferences: Set<string>) {
  if (item.tags.some((t) => excludeAllergens.has(t))) return false;
  if (requirePreferences.size > 0 && !item.tags.some((t) => requirePreferences.has(t))) return false;
  return true;
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: readonly string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <h3 className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200">
        {title}
      </h3>
      <ul>
        {options.map((opt) => (
          <li key={opt} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
            <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/40">
              <input
                type="checkbox"
                checked={selected.has(opt)}
                onChange={() => onToggle(opt)}
                className="size-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900"
              />
              {opt}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterPanel({
  excludeAllergens,
  requirePreferences,
  onToggleAllergen,
  onTogglePreference,
  onClear,
}: {
  excludeAllergens: Set<string>;
  requirePreferences: Set<string>;
  onToggleAllergen: (value: string) => void;
  onTogglePreference: (value: string) => void;
  onClear: () => void;
}) {
  const hasFilters = excludeAllergens.size > 0 || requirePreferences.size > 0;
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <FilterGroup title="Allergies" options={ALLERGENS} selected={excludeAllergens} onToggle={onToggleAllergen} />
      <FilterGroup
        title="Preferences"
        options={PREFERENCES}
        selected={requirePreferences}
        onToggle={onTogglePreference}
      />
      <div className="p-3">
        <button
          onClick={onClear}
          disabled={!hasFilters}
          className="w-full rounded-lg border border-red-300 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}

function HallColumn({
  hall,
  meal,
  now,
  mealMenu,
  excludeAllergens,
  requirePreferences,
  onSelect,
}: {
  hall: Hall;
  meal: Meal;
  now: CampusTime;
  mealMenu: Record<string, MenuItem[]> | undefined;
  excludeAllergens: Set<string>;
  requirePreferences: Set<string>;
  onSelect: (s: Selected) => void;
}) {
  const win = windowFor(hall, now.dow, meal);
  const servingNow = win && mealNow(hall.hours, now) === meal && statusAt(hall.hours, now).open;
  const stations = Object.entries(mealMenu ?? {})
    .map(([station, items]) => [station, items.filter((it) => itemPasses(it, excludeAllergens, requirePreferences))] as const)
    .filter(([, items]) => items.length > 0);
  const isFiltering = excludeAllergens.size > 0 || requirePreferences.size > 0;
  const hadItems = Object.values(mealMenu ?? {}).some((items) => items.length > 0);

  return (
    <section className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{hall.name}</h2>

      {servingNow && <p className="text-sm font-semibold text-green-700 dark:text-green-400">● Serving now</p>}

      {win ? (
        <p className="text-sm text-zinc-500">
          {meal} · {compactRange(win.open, win.close)}
        </p>
      ) : (
        <p className="text-sm text-zinc-500">No {meal.toLowerCase()} today</p>
      )}

      {stations.length > 0 ? (
        <div className="space-y-3 pt-1">
          {stations.map(([station, items]) => (
            <div key={station}>
              <h3 className="mb-1.5 text-sm font-bold text-zinc-800 dark:text-zinc-200">{station}</h3>
              <div className="space-y-1.5">
                {items.map((it) => (
                  <button
                    key={it.name}
                    onClick={() => onSelect({ item: it, context: `${hall.name} · ${station} · ${meal}` })}
                    className="flex w-full items-center justify-between gap-2 text-left text-sm text-zinc-700 hover:text-blue-600 hover:underline dark:text-zinc-300 dark:hover:text-blue-400"
                  >
                    <span>{it.name}</span>
                    <Tags tags={it.tags} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        win &&
        (hadItems && isFiltering ? (
          <p className="pt-1 text-sm text-zinc-400">No items match your filters</p>
        ) : (
          <p className="pt-1 text-sm text-zinc-400">No menu posted yet</p>
        ))
      )}
    </section>
  );
}

export function NetNutritionHomeLayout({ data, now }: HomeLayoutProps) {
  const [meal, setMeal] = useState<Meal>(() => mealByClock(now.minutes));
  const [excludeAllergens, setExcludeAllergens] = useState<Set<string>>(new Set());
  const [requirePreferences, setRequirePreferences] = useState<Set<string>>(new Set());
  const { open, sheet } = useItemSheet();

  const toggleAllergen = useCallback((value: string) => {
    setExcludeAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      track("net_nutrition_filter_toggled", { kind: "allergen", value, active: next.has(value) });
      return next;
    });
  }, []);
  const togglePreference = useCallback((value: string) => {
    setRequirePreferences((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      track("net_nutrition_filter_toggled", { kind: "preference", value, active: next.has(value) });
      return next;
    });
  }, []);
  const clearFilters = useCallback(() => {
    setExcludeAllergens(new Set());
    setRequirePreferences(new Set());
  }, []);

  const servingCount = HALLS.filter(
    (h) => windowFor(h, now.dow, meal) && mealNow(h.hours, now) === meal && statusAt(h.hours, now).open,
  ).length;

  const mealMenus = useMemo(
    () => Object.fromEntries(HALLS.map((h) => [h.slug, data.dates[now.iso]?.[h.name]?.[meal]])),
    [data, now.iso, meal],
  );

  return (
    <div>
      <header className="border-b border-zinc-200 px-4 pb-6 pt-8 text-center dark:border-zinc-800">
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-blue-600 dark:text-blue-400">Ham</span> Eats
        </h1>
        <div role="tablist" aria-label="Meal" className="mt-4 flex justify-center gap-2">
          {MEALS.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={m === meal}
              onClick={() => setMeal(m)}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
                m === meal
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <p className="mb-5 text-sm text-zinc-500">
          {servingCount > 0
            ? `${servingCount} of ${HALLS.length} halls serving ${meal.toLowerCase()} right now`
            : `No halls serving ${meal.toLowerCase()} right now`}
        </p>

        <div className="flex flex-col-reverse gap-6 lg:flex-row">
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            {HALLS.map((h) => (
              <HallColumn
                key={h.slug}
                hall={h}
                meal={meal}
                now={now}
                mealMenu={mealMenus[h.slug]}
                excludeAllergens={excludeAllergens}
                requirePreferences={requirePreferences}
                onSelect={open}
              />
            ))}
          </div>

          <aside className="lg:w-64 lg:shrink-0">
            <div className="lg:sticky lg:top-4">
              <FilterPanel
                excludeAllergens={excludeAllergens}
                requirePreferences={requirePreferences}
                onToggleAllergen={toggleAllergen}
                onTogglePreference={togglePreference}
                onClear={clearFilters}
              />
            </div>
          </aside>
        </div>
      </main>
      {sheet}
    </div>
  );
}
