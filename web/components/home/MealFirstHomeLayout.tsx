"use client";

import { useCallback, useEffect, useState } from "react";
import { HALLS, type Hall } from "@/lib/halls";
import { compactRange, mealNow, statusAt, type CampusTime } from "@/lib/hours";
import type { HomeLayoutProps } from "@/lib/homeLayouts";
import { MEALS, type Meal, type MenuData, type MenuItem } from "@/lib/types";
import { ItemSheet } from "@/components/ItemSheet";
import { track } from "@/lib/analytics";

/**
 * An alternative home layout, browsed meal-first — a close visual match of
 * Princeton's TigerMenus (https://menus.tigerapps.org/): its grey jumbotron
 * header, plain-text Breakfast/Lunch/Dinner nav, Bootstrap link-blue accent
 * (#337ab7), and flat, borderless hall columns with bold station headings
 * and plain-line dishes, no card chrome. TigerMenus is light-only; dark mode
 * here follows this app's existing zinc palette at the same hierarchy.
 * Layered on top: a live "serving now" indicator, which a static site can't have.
 */

// Bootstrap 3's default stack and link-blue, which TigerMenus never overrides.
const SITE_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const LINK_BLUE = "text-[#337ab7] dark:text-blue-400";

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

function HallColumn({
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
  const stations = Object.entries(mealMenu ?? {});

  return (
    <section className="space-y-2">
      {/* 24px/500, matching TigerMenus' .dining-hall h2 */}
      <h2 className="text-[24px] font-medium leading-[1.1] text-[#262626] dark:text-zinc-100">{hall.name}</h2>

      {servingNow && <p className={`text-sm font-semibold ${LINK_BLUE}`}>● Open now</p>}

      {win ? (
        <p className="text-sm text-[#606870] dark:text-zinc-400">
          {meal} · {compactRange(win.open, win.close)}
        </p>
      ) : (
        <p className="text-sm text-[#606870] dark:text-zinc-400">No {meal.toLowerCase()} today</p>
      )}

      {stations.length > 0 ? (
        <div className="space-y-3">
          {stations.map(([station, items]) => (
            <div key={station}>
              {/* Bold, inherits body size — matches .menu-station */}
              <h3 className="mb-1.5 text-sm font-bold text-[#262626] dark:text-zinc-200">{station}</h3>
              <div className="space-y-1.5">
                {items.map((it) => (
                  <button
                    key={it.name}
                    onClick={() => onSelect({ item: it, context: `${hall.name} · ${station} · ${meal}` })}
                    className="block text-left text-sm text-[#262626] hover:text-[#337ab7] hover:underline dark:text-zinc-300 dark:hover:text-blue-400"
                  >
                    {it.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        win && <p className="text-sm text-[#606870] dark:text-zinc-500">No menu posted yet</p>
      )}
    </section>
  );
}

export function MealFirstHomeLayout({ data, now }: HomeLayoutProps) {
  const [meal, setMeal] = useState<Meal>(() => mealByClock(now.minutes));
  const { open, sheet } = useItemSheet();

  const servingCount = HALLS.filter(
    (h) => windowFor(h, now.dow, meal) && mealNow(h.hours, now) === meal && statusAt(h.hours, now).open,
  ).length;

  return (
    <div style={{ fontFamily: SITE_FONT }}>
      {/* TigerMenus' jumbotron: light grey band, big -1px-tracked title, plain-text meal nav */}
      <header className="border-b border-[#e1e5e8] bg-[#eeeeee] px-4 pb-6 pt-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-[40px] font-medium tracking-[-1px] text-[#262626] dark:text-zinc-100">
          <span className="text-blue-600 dark:text-blue-400">Ham</span> Eats
        </h1>
        <div role="tablist" aria-label="Meal" className="mt-2 flex justify-center gap-4 text-lg">
          {MEALS.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={m === meal}
              onClick={() => setMeal(m)}
              className={`min-h-11 px-1 ${
                m === meal ? "font-bold text-[#262626] dark:text-white" : `${LINK_BLUE} hover:underline`
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <p className="mb-5 text-sm text-[#606870] dark:text-zinc-400">
          {servingCount > 0
            ? `${servingCount} of ${HALLS.length} halls serving ${meal.toLowerCase()} right now`
            : `No halls serving ${meal.toLowerCase()} right now`}
        </p>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {HALLS.map((h) => (
            <HallColumn key={h.slug} hall={h} meal={meal} now={now} data={data} onSelect={open} />
          ))}
        </div>
      </main>
      {sheet}
    </div>
  );
}
