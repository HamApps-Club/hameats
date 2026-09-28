"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dayOfMonth, shortWeekday } from "@/lib/dates";
import { HALLS, orderedStations, type Hall } from "@/lib/halls";
import { dowOf, statusAt, type CampusTime } from "@/lib/hours";
import type { HomeLayoutProps } from "@/lib/homeLayouts";
import { MEALS, type Meal, type MenuData, type MenuItem } from "@/lib/types";
import { ItemSheet } from "@/components/ItemSheet";
import { track } from "@/lib/analytics";

/**
 * A single-page layout modeled directly on a reference screenshot of a
 * Cornell dining app "Upcoming Menus" screen: a solid blue header, a plain
 * dark page, and dining halls stacked as expandable sections — tapping one
 * opens a bare list of stations and items in place, no card chrome per item.
 *
 * A single day + meal picker at the top of the page (not per-hall) controls
 * what every hall section shows once expanded.
 */

type Selected = { item: MenuItem; context: string };

/** Same back-button-closes-the-sheet behavior as the other home layouts. */
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

/** "07:00 - 10:30" — 24-hour, matching the reference screenshot's hour style. */
function militaryRange(open: number, close: number) {
  const hhmm = (min: number) => {
    const m = ((min % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };
  return `${hhmm(open)} - ${hhmm(close)}`;
}

/** The hours window backing the live status line: the current window if open, else the next one today. */
function displayedWindow(hall: Hall, now: CampusTime) {
  const status = statusAt(hall.hours, now);
  if (status.open) return { open: status.period.open, close: status.period.close };
  const today = hall.hours[now.dow];
  const next = today.find((p) => p.open > now.minutes);
  return next ?? today[0] ?? null;
}

const servesMealOnDay = (hall: Hall, dow: number, meal: Meal) => hall.hours[dow].some((p) => p.meal === meal);

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`size-4 shrink-0 text-zinc-400 transition dark:text-zinc-500 ${up ? "rotate-180" : ""}`}
    >
      <path d="M5.5 7.5 10 12.5l4.5-5" />
    </svg>
  );
}

function HallSection({
  hall,
  data,
  now,
  date,
  meal,
  expanded,
  onToggle,
  onSelectItem,
}: {
  hall: Hall;
  data: MenuData;
  now: CampusTime;
  date: string;
  meal: Meal;
  expanded: boolean;
  onToggle: () => void;
  onSelectItem: (item: MenuItem, station: string) => void;
}) {
  const liveToday = hall.hours[now.dow];
  const status = statusAt(hall.hours, now);
  const win = displayedWindow(hall, now);

  const dow = dowOf(date);
  const dayHours = hall.hours[dow];
  const servesSelectedMeal = hall.menuMeals ? hall.menuMeals.includes(meal) : servesMealOnDay(hall, dow, meal);
  const stations = data.dates[date]?.[hall.name]?.[meal];
  const entries = orderedStations(stations, hall.stationOrder);

  const emptyText = !dayHours.length
    ? "Closed on this day."
    : !servesSelectedMeal
      ? `No ${meal.toLowerCase()} on this day.`
      : `No ${meal.toLowerCase()} menu posted for this day.`;

  return (
    <section className="overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 p-5 text-left"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">{hall.name}</h3>
          <p className="text-base">
            <span className={status.open ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-red-500 dark:text-red-400"}>
              {status.open ? "Open" : "Closed"}
            </span>
            {win && <span className="text-zinc-500 dark:text-zinc-400"> · {militaryRange(win.open, win.close)}</span>}
            {!liveToday.length && <span className="text-zinc-500 dark:text-zinc-400"> · Closed today</span>}
          </p>
        </div>
        <span className="pt-1.5">
          <ChevronIcon up={expanded} />
        </span>
      </button>

      {expanded && (
        <div className="space-y-5 px-5 pb-6">
          {entries.length ? (
            entries.map(([station, items]) => (
              <div key={station}>
                <h4 className="mb-1 text-lg font-bold text-zinc-900 dark:text-white">{station}</h4>
                <ul>
                  {items.map((it) => (
                    <li key={it.name}>
                      <button
                        onClick={() => onSelectItem(it, station)}
                        className="block w-full py-0.5 text-left text-base text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                      >
                        {it.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="text-base text-zinc-500 dark:text-zinc-400">{emptyText}</p>
          )}
        </div>
      )}
    </section>
  );
}

export function AccordionHomeLayout({ data, now }: HomeLayoutProps) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const dates = useMemo(() => Object.keys(data.dates).sort(), [data]);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [pickedMeal, setPickedMeal] = useState<Meal | null>(null);
  const { open, sheet } = useItemSheet();

  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : (dates.includes(now.iso) ? now.iso : dates[0]);
  const meal = pickedMeal ?? mealByClock(now.minutes);

  const toggle = useCallback((slug: string) => {
    setOpenSlug((cur) => (cur === slug ? null : slug));
  }, []);

  return (
    <>
      <header className="sticky top-0 z-10 bg-blue-500 dark:bg-blue-600">
        <h1 className="py-4 text-center text-xl font-semibold text-white">Ham Eats</h1>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <div className="grid grid-cols-7 gap-1" role="group" aria-label="Day">
          {dates.map((d) => (
            <button
              key={d}
              onClick={() => setPickedDate(d)}
              aria-pressed={d === date}
              className={`flex flex-col items-center rounded-xl py-2 ${
                d === date
                  ? "bg-blue-500 text-white dark:bg-blue-600"
                  : "text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="text-xs">{d === now.iso ? "Today" : shortWeekday(d)}</span>
              <span className="text-lg font-bold tabular-nums">{dayOfMonth(d)}</span>
            </button>
          ))}
        </div>

        <div role="tablist" aria-label="Meal" className="flex rounded-lg bg-zinc-200/70 p-0.5 dark:bg-zinc-800">
          {MEALS.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={m === meal}
              onClick={() => setPickedMeal(m)}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
                m === meal
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {HALLS.map((h) => (
          <HallSection
            key={h.slug}
            hall={h}
            data={data}
            now={now}
            date={date}
            meal={meal}
            expanded={openSlug === h.slug}
            onToggle={() => toggle(h.slug)}
            onSelectItem={(item, station) => open({ item, context: `${h.name} · ${station} · ${meal}` })}
          />
        ))}
      </main>
      {sheet}
    </>
  );
}
