"use client";

import { useMemo, useState } from "react";
import { HALLS, orderedStations, type Hall } from "@/lib/halls";
import { compactRange, dowOf, mealNow, statusAt } from "@/lib/hours";
import type { HomeLayoutProps } from "@/lib/homeLayouts";
import { type Meal, type MenuItem } from "@/lib/types";
import { DayPicker } from "@/components/DayPicker";
import { MealHeader } from "@/components/home/MealHeader";
import { track } from "@/lib/analytics";

/**
 * An alternative home layout, browsed meal-first — a close visual match of
 * Princeton's TigerMenus (https://menus.tigerapps.org/): its grey jumbotron
 * header, plain-text Breakfast/Lunch/Dinner nav, Bootstrap link-blue accent
 * (#337ab7), bold station headings and plain-line dishes (nothing to tap), with
 * each hall in a card and the two cards' station headings kept level. TigerMenus is light-only; dark mode
 * here follows this app's existing zinc palette at the same hierarchy.
 * Layered on top: a live "serving now" indicator, which a static site can't have.
 */

// Bootstrap 3's default stack, which TigerMenus never overrides. The link-blue
// itself is Ham Eats' shared accent color, not TigerMenus' Bootstrap blue.
const SITE_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const LINK_BLUE = "text-accent";

/** Fallback meal for the day when nothing is currently open anywhere: go by time of day. */
function mealByClock(minutes: number): Meal {
  if (minutes < 10 * 60 + 30) return "Breakfast";
  if (minutes < 16 * 60) return "Lunch";
  return "Dinner";
}

/** The two main dining halls, side by side; the Diner and Little Pub are left out of this layout. */
const COMPARED_HALLS = HALLS.filter((h) => h.slug === "commons" || h.slug === "mcewen");

/** This hall's first service window for `meal` on weekday `dow`, or undefined if it doesn't serve it. */
function windowFor(hall: Hall, dow: number, meal: Meal) {
  return hall.hours[dow].find((p) => p.meal === meal);
}

/**
 * Station order in this layout, per hall. Stations a hall serves that aren't listed follow, in the
 * menu's own order.
 */
const STATION_ORDER: Record<string, string[]> = {
  commons: ["Spoon & Fork", "Inspired Eats", "Fresh Stock", "V2", "Grill", "Bravo", "Oven"],
  mcewen: ["Spoon & Fork", "Grill", "Fresh Stock", "Oven"],
};

// Nutrislice tends to list a station's main dish last ("Herb Roasted Fingerling Potato", then "Peach
// Balsamic Chicken"); this moves meat and fish mains to the top. Everything else keeps its order.
const MAIN_DISH = /\b(chicken|beef|pork|steak|turkey|ham|bacon|sausage|brisket|meatballs?|lamb|salmon|cod|haddock|tilapia|pollock|fish|shrimp|tuna)\b/i;
const mainsFirst = (items: MenuItem[]) =>
  [...items].sort((a, b) => Number(MAIN_DISH.test(b.name)) - Number(MAIN_DISH.test(a.name)));

type Column = {
  hall: Hall;
  win: ReturnType<typeof windowFor>;
  servingNow: boolean | undefined;
  stations: [string, MenuItem[]][];
};

/** A hall's name, "Open now" and meal hours: the first row of its card. */
function HallHeading({ column: { hall, win, servingNow }, meal, isToday }: { column: Column; meal: Meal; isToday: boolean }) {
  return (
    <div className="space-y-2 pb-3">
      {/* 24px/500, matching TigerMenus' .dining-hall h2 */}
      <h2 className="text-[24px] font-medium leading-[1.1] text-[#262626] dark:text-zinc-100">{hall.name}</h2>
      {servingNow && <p className={`text-sm font-semibold ${LINK_BLUE}`}>● Open now</p>}
      <p className="text-sm text-[#606870] dark:text-zinc-400">
        {win ? `${meal} · ${compactRange(win.open, win.close)}` : `No ${meal.toLowerCase()} ${isToday ? "today" : "this day"}`}
      </p>
    </div>
  );
}

/** One station: a bold heading and its dishes as plain text (nothing to tap). */
function Station({ station }: { station: [string, MenuItem[]] | undefined }) {
  if (!station) return <div />;
  const [name, items] = station;
  return (
    <div className="pb-4">
      <h3 className="mb-1.5 text-sm font-bold text-[#262626] dark:text-zinc-200">{name}</h3>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.name} className="text-sm text-[#262626] dark:text-zinc-300">
            {it.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Comparison layout: Commons and McEwen side by side in cards, station headings level across both. */
export function MealFirstHomeLayout({ data, now }: HomeLayoutProps) {
  const [meal, setMeal] = useState<Meal>(() => mealByClock(now.minutes));
  const dates = useMemo(() => Object.keys(data.dates).sort(), [data]);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : now.iso;
  const isToday = date === now.iso;

  const columns: Column[] = COMPARED_HALLS.map((hall) => {
    const win = windowFor(hall, dowOf(date), meal);
    const stations = orderedStations(data.dates[date]?.[hall.name]?.[meal], STATION_ORDER[hall.slug]).map(
      ([name, items]) => [name, mainsFirst(items)] as [string, MenuItem[]],
    );
    return { hall, win, servingNow: isToday && win && mealNow(hall.hours, now) === meal && statusAt(hall.hours, now).open, stations };
  });
  // Row 1 is each hall's heading; then one row per station slot, so both halls' Nth station headings
  // line up across the two cards. At least one slot, for the "No menu posted yet" note.
  const slots = Math.max(1, ...columns.map((c) => c.stations.length));

  return (
    <div style={{ fontFamily: SITE_FONT }}>
      <MealHeader meal={meal} onSelectMeal={setMeal} />

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

        <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4">
          {columns.map((c) => (
            // Each card spans every row and shares them (subgrid), which is what keeps headings level.
            <section
              key={c.hall.slug}
              style={{ gridRow: `span ${slots + 1}` }}
              className="grid grid-rows-subgrid rounded-2xl border border-zinc-200 bg-white px-4 pt-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <HallHeading column={c} meal={meal} isToday={isToday} />
              {c.stations.length > 0
                ? Array.from({ length: slots }, (_, i) => <Station key={i} station={c.stations[i]} />)
                : [
                    <p key="empty" className="pb-4 text-sm text-[#606870] dark:text-zinc-500">
                      {c.win ? "No menu posted yet" : ""}
                    </p>,
                    ...Array.from({ length: slots - 1 }, (_, i) => <div key={i} />),
                  ]}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
