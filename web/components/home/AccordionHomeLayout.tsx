"use client";

import { useCallback, useEffect, useState } from "react";
import { HALLS, type Hall } from "@/lib/halls";
import { mealNow, statusAt, type CampusTime } from "@/lib/hours";
import type { HomeLayoutProps } from "@/lib/homeLayouts";
import { searchMenus } from "@/lib/search";
import { MEALS, type Meal, type MenuData, type MenuItem } from "@/lib/types";
import { ItemSheet } from "@/components/ItemSheet";
import { MenuList } from "@/components/MenuList";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { StatusLine } from "@/components/HoursPanel";
import { track } from "@/lib/analytics";
import { useMemo } from "react";

/**
 * A single-page layout: every hall is listed together, and tapping one expands
 * its menu inline (no navigation away), matching a reference screenshot where
 * dining halls stack as expandable cards on one "Upcoming Menus" page.
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

/** Fallback meal for the day when a hall isn't currently serving: go by time of day. */
function mealByClock(minutes: number): Meal {
  if (minutes < 10 * 60 + 30) return "Breakfast";
  if (minutes < 16 * 60) return "Lunch";
  return "Dinner";
}

const hasMenu = (data: MenuData, iso: string, hall: Hall, meal: Meal) =>
  Object.keys(data.dates[iso]?.[hall.name]?.[meal] ?? {}).length > 0;

const servesMeal = (hall: Hall, meal: Meal) => hall.hours.some((d) => d.some((x) => x.meal === meal));

function mealTabs(data: MenuData, iso: string, hall: Hall) {
  return hall.menuMeals ?? MEALS.filter((m) => servesMeal(hall, m) || hasMenu(data, iso, hall, m));
}

function HallCard({
  hall,
  data,
  now,
  expanded,
  onToggle,
  onSelectItem,
}: {
  hall: Hall;
  data: MenuData;
  now: CampusTime;
  expanded: boolean;
  onToggle: () => void;
  onSelectItem: (item: MenuItem, meal: Meal, station: string) => void;
}) {
  const today = hall.hours[now.dow];
  const status = statusAt(hall.hours, now);
  const tabs = mealTabs(data, now.iso, hall);
  const [meal, setMeal] = useState<Meal>(() => mealNow(hall.hours, now) ?? mealByClock(now.minutes));
  const shownMeal = tabs.includes(meal) ? meal : tabs[0];
  const stations = shownMeal ? data.dates[now.iso]?.[hall.name]?.[shownMeal] : undefined;

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="text-xl font-semibold">{hall.name}</h3>
          <StatusLine status={status} caps />
          {today.length === 0 && <p className="text-sm text-zinc-500">Closed today</p>}
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          className={`size-5 shrink-0 text-zinc-400 transition ${expanded ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          {tabs.length > 1 && (
            <div role="tablist" aria-label="Meal" className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
              {tabs.map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={m === shownMeal}
                  onClick={() => setMeal(m)}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
                    m === shownMeal ? "bg-white shadow-sm dark:bg-zinc-950" : "text-zinc-500"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <MenuList
            stations={stations}
            stationOrder={hall.stationOrder}
            emptyText={
              today.length === 0 ? "Closed today." : `No ${(shownMeal ?? "menu").toLowerCase()} menu posted for today.`
            }
            onSelect={(item, station) => onSelectItem(item, shownMeal ?? "Breakfast", station)}
          />
        </div>
      )}
    </section>
  );
}

export function AccordionHomeLayout({ data, now }: HomeLayoutProps) {
  const [query, setQuery] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
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

  const toggle = useCallback((slug: string) => {
    setOpenSlug((cur) => (cur === slug ? null : slug));
  }, []);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <h1 className="py-4 text-center text-3xl font-bold tracking-tight">
          <span className="text-blue-600 dark:text-blue-400">Ham</span> Eats
        </h1>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <SearchBar onSearch={handleSearch} />
        {query.trim() ? (
          <SearchResults
            rows={results}
            query={query}
            week
            onSelect={(r) => open({ item: r.item, context: `${r.location} · ${r.station} · ${r.meal}` })}
          />
        ) : (
          HALLS.map((h) => (
            <HallCard
              key={h.slug}
              hall={h}
              data={data}
              now={now}
              expanded={openSlug === h.slug}
              onToggle={() => toggle(h.slug)}
              onSelectItem={(item, meal, station) => open({ item, context: `${h.name} · ${station} · ${meal}` })}
            />
          ))
        )}
      </main>
      {sheet}
    </>
  );
}
