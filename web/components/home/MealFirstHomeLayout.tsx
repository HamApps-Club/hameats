"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HALLS, type Hall } from "@/lib/halls";
import { compactRange, mealNow, statusAt, type CampusTime } from "@/lib/hours";
import type { HomeLayoutProps } from "@/lib/homeLayouts";
import { searchMenus } from "@/lib/search";
import { MEALS, type Meal, type MenuData, type MenuItem } from "@/lib/types";
import { ItemSheet } from "@/components/ItemSheet";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { track } from "@/lib/analytics";

/**
 * An alternative home layout, browsed meal-first (à la Princeton's TigerMenus:
 * https://menus.tigerapps.org/, which leads with Breakfast/Lunch/Dinner tabs
 * rather than a hall-first list). Halls are shown as a card grid, each scoped
 * to the selected meal, with a live "serving now" indicator layered on top —
 * the one thing a static meal-nav site like TigerMenus doesn't have.
 */

type Selected = { item: MenuItem; context: string };

/** Same back-button-closes-the-sheet behavior as the main home layout. */
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

/** Fallback meal for the day when nothing is currently open anywhere: go by time of day. */
function mealByClock(minutes: number): Meal {
  if (minutes < 10 * 60 + 30) return "Breakfast";
  if (minutes < 16 * 60) return "Lunch";
  return "Dinner";
}

/** This hall's first service window for `meal` today, or undefined if it doesn't serve it. */
function windowFor(hall: Hall, dow: number, meal: Meal) {
  return hall.hours[dow].find((p) => p.meal === meal);
}

function HallCard({
  hall,
  meal,
  now,
  data,
  onSelect,
}: {
  hall: Hall;
  meal: Meal;
  now: CampusTime;
  data: MenuData;
  onSelect: (s: Selected) => void;
}) {
  const win = windowFor(hall, now.dow, meal);
  const servingNow = win && mealNow(hall.hours, now) === meal && statusAt(hall.hours, now).open;
  const mealMenu = data.dates[now.iso]?.[hall.name]?.[meal];
  const stations = mealMenu ? Object.keys(mealMenu) : [];
  const items = mealMenu ? Object.values(mealMenu).flat() : [];

  return (
    <a
      href={`#${hall.slug}`}
      onClick={() => window.scrollTo({ top: 0 })}
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold">{hall.name}</h3>
        {servingNow && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">
            <span className="size-1.5 rounded-full bg-green-600 dark:bg-green-400" />
            Now
          </span>
        )}
      </div>

      {win ? (
        <p className="text-sm text-zinc-500">
          {meal} · {compactRange(win.open, win.close)}
        </p>
      ) : (
        <p className="text-sm text-zinc-400">No {meal.toLowerCase()} today</p>
      )}

      {stations.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {stations.slice(0, 3).join(" · ")}
            {stations.length > 3 && ` +${stations.length - 3} more`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {items.slice(0, 3).map((it) => (
              <button
                key={it.name}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const station = stations.find((s) => mealMenu?.[s].includes(it)) ?? "";
                  onSelect({ item: it, context: `${hall.name} · ${station} · ${meal}` });
                }}
                className="max-w-full truncate rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
              >
                {it.name}
              </button>
            ))}
          </div>
        </div>
      ) : win ? (
        <p className="text-sm text-zinc-400">No menu posted yet</p>
      ) : null}
    </a>
  );
}

export function MealFirstHomeLayout({ data, now }: HomeLayoutProps) {
  const [query, setQuery] = useState("");
  const [meal, setMeal] = useState<Meal>(() => mealByClock(now.minutes));
  const dates = useMemo(() => Object.keys(data.dates).sort(), [data]);
  const results = useMemo(() => searchMenus(data, dates, query), [data, dates, query]);
  const { open, sheet } = useItemSheet();

  const handleSearch = useCallback(
    (q: string) => {
      if (q.trim() && !query.trim()) track("search_used");
      setQuery(q);
    },
    [query],
  );

  const servingCount = HALLS.filter(
    (h) => windowFor(h, now.dow, meal) && mealNow(h.hours, now) === meal && statusAt(h.hours, now).open,
  ).length;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <h1 className="py-4 text-center text-3xl font-bold tracking-tight">
          <span className="text-blue-600 dark:text-blue-400">Ham</span> Eats
        </h1>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <SearchBar onSearch={handleSearch} />
        {query.trim() ? (
          <SearchResults
            rows={results}
            query={query}
            week
            onSelect={(r) => open({ item: r.item, context: `${r.location} · ${r.station} · ${r.meal}` })}
          />
        ) : (
          <>
            <div role="tablist" aria-label="Meal" className="flex gap-2">
              {MEALS.map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={m === meal}
                  onClick={() => setMeal(m)}
                  className={`flex-1 rounded-xl py-2.5 text-base font-semibold transition ${
                    m === meal
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <p className="text-sm text-zinc-500">
              {servingCount > 0
                ? `${servingCount} of ${HALLS.length} halls serving ${meal.toLowerCase()} right now`
                : `No halls serving ${meal.toLowerCase()} right now`}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {HALLS.map((h) => (
                <HallCard key={h.slug} hall={h} meal={meal} now={now} data={data} onSelect={open} />
              ))}
            </div>
          </>
        )}
      </main>
      {sheet}
    </>
  );
}
