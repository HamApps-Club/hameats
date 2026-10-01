"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HALLS, orderedStations, type Hall } from "@/lib/halls";
import { compactRange, dowOf, mealNow, statusAt, type CampusTime } from "@/lib/hours";
import type { HomeLayoutProps } from "@/lib/homeLayouts";
import { MEALS, type Meal, type MenuData, type MenuItem } from "@/lib/types";
import { DayPicker } from "@/components/DayPicker";
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

// Bootstrap 3's default stack, which TigerMenus never overrides. The link-blue
// itself is Ham Eats' shared accent color, not TigerMenus' Bootstrap blue.
const SITE_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const LINK_BLUE = "text-accent";

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

/** This hall's first service window for `meal` on weekday `dow`, or undefined if it doesn't serve it. */
function windowFor(hall: Hall, dow: number, meal: Meal) {
  return hall.hours[dow].find((p) => p.meal === meal);
}

function HallColumn({
  hall,
  meal,
  date,
  now,
  data,
  onSelect,
}: {
  hall: Hall;
  meal: Meal;
  date: string;
  now: CampusTime;
  data: MenuData;
  onSelect: (s: Selected) => void;
}) {
  const isToday = date === now.iso;
  const win = windowFor(hall, dowOf(date), meal);
  const servingNow = isToday && win && mealNow(hall.hours, now) === meal && statusAt(hall.hours, now).open;
  const mealMenu = data.dates[date]?.[hall.name]?.[meal];
  const stations = orderedStations(mealMenu, hall.stationOrder);

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
        <p className="text-sm text-[#606870] dark:text-zinc-400">
          No {meal.toLowerCase()} {isToday ? "today" : "this day"}
        </p>
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
                    className="block text-left text-sm text-[#262626] hover:text-accent hover:underline dark:text-zinc-300 dark:hover:text-accent"
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

/** Comparison layout: two halls side by side on phones, four across on wide screens. */
export function MealFirstHomeLayout({ data, now }: HomeLayoutProps) {
  const [meal, setMeal] = useState<Meal>(() => mealByClock(now.minutes));
  const dates = useMemo(() => Object.keys(data.dates).sort(), [data]);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : now.iso;
  const { open, sheet } = useItemSheet();


  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        {/* On phones the title centers in the gap between the Switch Layout button and the theme toggle. */}
        <h1 className="py-4 pl-36 pr-14 text-center text-2xl font-bold tracking-tight sm:px-0 sm:text-3xl">
          <span className="text-accent">Ham</span> Eats
        </h1>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mx-auto mb-5 max-w-2xl">
          <DayPicker
            dates={dates}
            selected={date}
            today={now.iso}
            onSelect={(d) => {
              setPickedDate(d);
              track("comparison_day_picked", { date: d });
            }}
          />
        </div>

        <div
          role="tablist"
          aria-label="Meal"
          className="mx-auto mb-5 flex max-w-2xl border-b border-zinc-200 dark:border-zinc-800"
        >
          {MEALS.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={m === meal}
              onClick={() => setMeal(m)}
              className={`-mb-px flex-1 border-b-2 py-2.5 text-base ${
                m === meal
                  ? "border-zinc-900 font-semibold dark:border-white"
                  : "border-transparent text-zinc-500"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4" style={{ fontFamily: SITE_FONT }}>
          {HALLS.map((h) => (
            <HallColumn key={h.slug} hall={h} meal={meal} date={date} now={now} data={data} onSelect={open} />
          ))}
        </div>
      </main>
      {sheet}
    </div>
  );
}
