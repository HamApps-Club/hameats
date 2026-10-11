"use client";

import { useCallback, useMemo, useState } from "react";
import { HALLS, orderedStations, type Hall } from "@/lib/halls";
import { dayHours, statusAt, summaryParts, type CampusTime } from "@/lib/hours";
import type { HomeLayoutProps } from "@/lib/homeLayouts";
import { MEALS, type Meal, type MenuItem } from "@/lib/types";
import { daysFrom } from "@/lib/dates";
import { DayPicker } from "@/components/DayPicker";
import { StatusLine } from "@/components/HoursPanel";
import { Tags } from "@/components/Tags";
import {
  FilterBar,
  itemPasses,
  mealByClock,
  useItemSheet,
  windowFor,
  type Selected,
} from "@/components/home/NetNutritionHomeLayout";
import { track } from "@/lib/analytics";
import { SiteTitle } from "@/components/SiteTitle";

/**
 * Continental's day picker, meal tabs and filters, over Classic's stack of hall cards. Each card
 * starts collapsed, showing what Classic shows (name, open or closed, the day's hours); tapping it
 * opens the hall's menu for the picked meal right inside the card, in slightly larger type.
 */

/** Down chevron that flips to point up while its card is open. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className={`size-5 shrink-0 text-zinc-400 transition ${open ? "rotate-180" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const sectionId = (hall: Hall) => `collapsible-${hall.slug}`;

function HallCard({
  hall,
  meal,
  date,
  now,
  mealMenu,
  excludeAllergens,
  requirePreferences,
  showIcons,
  collapsed,
  onToggleCollapsed,
  onSelect,
}: {
  hall: Hall;
  meal: Meal;
  date: string;
  now: CampusTime;
  mealMenu: Record<string, MenuItem[]> | undefined;
  excludeAllergens: Set<string>;
  requirePreferences: Set<string>;
  showIcons: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelect: (s: Selected) => void;
}) {
  const isToday = date === now.iso;
  const day = dayHours(hall.hours, date);
  const win = windowFor(hall, date, meal);
  const stations = orderedStations(mealMenu, hall.stationOrder)
    .map(([station, items]) => [station, items.filter((it) => itemPasses(it, excludeAllergens, requirePreferences))] as const)
    .filter(([, items]) => items.length > 0);
  const isFiltering = excludeAllergens.size > 0 || requirePreferences.size > 0;
  const hadItems = Object.values(mealMenu ?? {}).some((items) => items.length > 0);

  return (
    <section
      id={sectionId(hall)}
      className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-surface"
    >
      {/* Classic's hall card, as the button that opens and closes this one. */}
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={`${sectionId(hall)}-body`}
        onClick={onToggleCollapsed}
        className="flex w-full items-center gap-4 p-5 text-left"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="text-xl font-semibold">{hall.name}</h2>
          {/* Open or closed is about right now, so it's only shown on today's menus. */}
          {isToday && <StatusLine status={statusAt(hall.hours, now)} caps />}
          {day.length ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-sm tabular-nums text-zinc-500">
              {summaryParts(day).map((part) => (
                <div key={part.name} className="contents">
                  <dt>{part.name}</dt>
                  <dd>{part.hours}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-zinc-500">Closed {isToday ? "today" : "this day"}</p>
          )}
        </div>
        <Chevron open={!collapsed} />
      </button>

      {!collapsed && (
        <div
          id={`${sectionId(hall)}-body`}
          className="mx-5 border-t border-zinc-200 pb-5 pt-4 dark:border-zinc-800"
        >
          {!win ? (
            <p className="text-base text-zinc-400">
              No {meal.toLowerCase()} {isToday ? "today" : "this day"}
            </p>
          ) : stations.length > 0 ? (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {stations.map(([station, items]) => (
                <div key={station} className="py-4 first:pt-0 last:pb-0">
                  <h3 className="mb-2 text-base font-bold text-zinc-800 dark:text-zinc-200">{station}</h3>
                  <div className="space-y-2">
                    {items.map((it) => (
                      <button
                        key={it.name}
                        onClick={() => onSelect({ item: it, context: `${hall.name} · ${station} · ${meal}` })}
                        className="flex w-full items-center justify-between gap-2 text-left text-base text-zinc-700 hover:text-blue-600 hover:underline dark:text-zinc-300 dark:hover:text-blue-400"
                      >
                        <span>{it.name}</span>
                        {showIcons && <Tags tags={it.tags} />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : hadItems && isFiltering ? (
            <p className="text-base text-zinc-400">No items match your filters</p>
          ) : (
            <p className="text-base text-zinc-400">No menu posted yet</p>
          )}
        </div>
      )}
    </section>
  );
}

export function CollapsibleHomeLayout({ data, now }: HomeLayoutProps) {
  const [meal, setMeal] = useState<Meal>(() => mealByClock(now));
  // Today is always the first day, then the six after it (the menu data may be a day or two old).
  const dates = useMemo(() => daysFrom(now.iso), [now.iso]);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : now.iso;
  const [excludeAllergens, setExcludeAllergens] = useState<Set<string>>(new Set());
  const [requirePreferences, setRequirePreferences] = useState<Set<string>>(new Set());
  const [showIcons, setShowIcons] = useState(false);
  // Every hall starts collapsed; tap one to open its menu.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(HALLS.map((h) => h.slug)));
  const { open, sheet } = useItemSheet();

  const toggleCollapsed = useCallback((hall: Hall) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(hall.slug)) next.delete(hall.slug);
      else next.add(hall.slug);
      track("collapsible_hall_collapsed", { hall: hall.slug, collapsed: next.has(hall.slug) });
      return next;
    });
  }, []);
  const toggleAllergen = useCallback((value: string) => {
    setExcludeAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      track("collapsible_allergen_toggled", { allergen: value, active: next.has(value) });
      return next;
    });
  }, []);
  const togglePreference = useCallback((value: string) => {
    setRequirePreferences((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      track("collapsible_preference_toggled", { preference: value, active: next.has(value) });
      return next;
    });
  }, []);
  const clearFilters = useCallback(() => {
    setExcludeAllergens(new Set());
    setRequirePreferences(new Set());
  }, []);

  const mealMenus = useMemo(
    () => Object.fromEntries(HALLS.map((h) => [h.slug, data.dates[date]?.[h.name]?.[meal]])),
    [data, date, meal],
  );

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-background dark:border-zinc-800">
        <SiteTitle />
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-5">
          <DayPicker
            dates={dates}
            selected={date}
            today={now.iso}
            onSelect={(d) => {
              setPickedDate(d);
              track("collapsible_day_picked", { date: d });
            }}
          />
        </div>

        <div role="tablist" aria-label="Meal" className="mb-5 flex border-b border-zinc-200 dark:border-zinc-800">
          {MEALS.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={m === meal}
              onClick={() => setMeal(m)}
              className={`-mb-px flex-1 border-b-2 py-2.5 text-base ${
                m === meal ? "border-zinc-900 font-semibold dark:border-white" : "border-transparent text-zinc-500"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="mb-5">
          <FilterBar
            excludeAllergens={excludeAllergens}
            requirePreferences={requirePreferences}
            onToggleAllergen={toggleAllergen}
            onTogglePreference={togglePreference}
            onClear={clearFilters}
            showIcons={showIcons}
            onToggleIcons={() => {
              track("collapsible_icons_toggled", { active: !showIcons });
              setShowIcons(!showIcons);
            }}
          />
        </div>

        <div className="space-y-3">
          {HALLS.map((h) => (
            <HallCard
              key={h.slug}
              hall={h}
              meal={meal}
              date={date}
              now={now}
              mealMenu={mealMenus[h.slug]}
              excludeAllergens={excludeAllergens}
              requirePreferences={requirePreferences}
              showIcons={showIcons}
              collapsed={collapsed.has(h.slug)}
              onToggleCollapsed={() => toggleCollapsed(h)}
              onSelect={open}
            />
          ))}
        </div>
      </main>
      {sheet}
    </div>
  );
}
