"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HALLS, orderedStations, type Hall } from "@/lib/halls";
import { compactRange, dowOf, mealNow, statusAt, type CampusTime } from "@/lib/hours";
import type { HomeLayoutProps } from "@/lib/homeLayouts";
import { type Meal, type MenuItem } from "@/lib/types";
import { DayPicker } from "@/components/DayPicker";
import { ItemSheet } from "@/components/ItemSheet";
import { MealHeader } from "@/components/home/MealHeader";
import { Tags } from "@/components/Tags";
import { track } from "@/lib/analytics";
import { formatDate } from "@/lib/dates";

/**
 * A fourth home layout inspired by Bowdoin Dining's "Net Nutrition" tool: the
 * same meal-first, no-search, no-click-navigation browsing as Meal First
 * (web/components/home/MealFirstHomeLayout.tsx), plus a filter panel that
 * narrows every hall's menu at once by allergen and dietary preference
 * (Allergies and Preferences dropdowns in a bar above the halls).
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

type FilterGroupId = "allergies" | "preferences";

/** One option as a toggle pill; filled blue when selected. */
function FilterChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`min-h-9 rounded-full border px-3 text-sm font-medium ${
        selected
          ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {label}
    </button>
  );
}

/** A dropdown trigger showing how many of its options are on. */
function FilterToggle({
  label,
  count,
  expanded,
  onClick,
}: {
  label: string;
  count: number;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onClick}
      className={`flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${
        expanded || count > 0
          ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
          : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
      } bg-white dark:bg-zinc-900`}
    >
      {label}
      {count > 0 && (
        <span className="rounded-full bg-blue-600 px-1.5 text-xs leading-5 text-white dark:bg-blue-500">{count}</span>
      )}
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
        className={`size-4 transition ${expanded ? "rotate-180" : ""}`}
      >
        <path
          fillRule="evenodd"
          d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

/**
 * A compact row of dropdowns (Allergies, Preferences) above the halls. Opening one drops down its
 * options as a wrapped row of pills; tapping outside or pressing Escape closes it.
 */
function FilterBar({
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
  const [openGroup, setOpenGroup] = useState<FilterGroupId | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hasFilters = excludeAllergens.size > 0 || requirePreferences.size > 0;

  useEffect(() => {
    if (!openGroup) return;
    const onPointer = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenGroup(null);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [openGroup]);

  const toggleGroup = (id: FilterGroupId) => setOpenGroup((cur) => (cur === id ? null : id));
  const [options, selected, onToggle] =
    openGroup === "allergies"
      ? [ALLERGENS, excludeAllergens, onToggleAllergen]
      : [PREFERENCES, requirePreferences, onTogglePreference];

  return (
    <div ref={barRef} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterToggle
          label="Allergies"
          count={excludeAllergens.size}
          expanded={openGroup === "allergies"}
          onClick={() => toggleGroup("allergies")}
        />
        <FilterToggle
          label="Preferences"
          count={requirePreferences.size}
          expanded={openGroup === "preferences"}
          onClick={() => toggleGroup("preferences")}
        />
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="ml-1 min-h-10 px-2 text-sm font-semibold text-red-700 hover:underline dark:text-red-400"
          >
            Clear
          </button>
        )}
      </div>
      {openGroup && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-xs text-zinc-500">
            {openGroup === "allergies" ? "Hide items that contain:" : "Only show items that are:"}
          </p>
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
              <FilterChip key={opt} label={opt} selected={selected.has(opt)} onToggle={() => onToggle(opt)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HallColumn({
  hall,
  meal,
  date,
  now,
  mealMenu,
  excludeAllergens,
  requirePreferences,
  onSelect,
}: {
  hall: Hall;
  meal: Meal;
  date: string;
  now: CampusTime;
  mealMenu: Record<string, MenuItem[]> | undefined;
  excludeAllergens: Set<string>;
  requirePreferences: Set<string>;
  onSelect: (s: Selected) => void;
}) {
  const isToday = date === now.iso;
  const win = windowFor(hall, dowOf(date), meal);
  const servingNow = isToday && win && mealNow(hall.hours, now) === meal && statusAt(hall.hours, now).open;
  const stations = orderedStations(mealMenu, hall.stationOrder)
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
        <p className="text-sm text-zinc-500">
          No {meal.toLowerCase()} {isToday ? "today" : "this day"}
        </p>
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
  const dates = useMemo(() => Object.keys(data.dates).sort(), [data]);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : now.iso;
  const isToday = date === now.iso;
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

  const servingCount = isToday
    ? HALLS.filter(
        (h) => windowFor(h, now.dow, meal) && mealNow(h.hours, now) === meal && statusAt(h.hours, now).open,
      ).length
    : 0;

  const mealMenus = useMemo(
    () => Object.fromEntries(HALLS.map((h) => [h.slug, data.dates[date]?.[h.name]?.[meal]])),
    [data, date, meal],
  );

  return (
    <div>
      <MealHeader meal={meal} onSelectMeal={setMeal} />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mx-auto mb-5 max-w-2xl">
          <DayPicker
            dates={dates}
            selected={date}
            today={now.iso}
            onSelect={(d) => {
              setPickedDate(d);
              track("net_nutrition_day_picked", { date: d });
            }}
          />
        </div>

        <p className="mb-5 text-sm text-zinc-500">
          {!isToday
            ? `${meal} on ${formatDate(date)}`
            : servingCount > 0
            ? `${servingCount} of ${HALLS.length} halls serving ${meal.toLowerCase()} right now`
            : `No halls serving ${meal.toLowerCase()} right now`}
        </p>

        <div className="sticky top-0 z-10 -mx-4 mb-5 bg-zinc-50/95 px-4 py-3 backdrop-blur dark:bg-zinc-950/95">
          <FilterBar
            excludeAllergens={excludeAllergens}
            requirePreferences={requirePreferences}
            onToggleAllergen={toggleAllergen}
            onTogglePreference={togglePreference}
            onClear={clearFilters}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HALLS.map((h) => (
            <HallColumn
              key={h.slug}
              hall={h}
              meal={meal}
              date={date}
              now={now}
              mealMenu={mealMenus[h.slug]}
              excludeAllergens={excludeAllergens}
              requirePreferences={requirePreferences}
              onSelect={open}
            />
          ))}
        </div>
      </main>
      {sheet}
    </div>
  );
}
