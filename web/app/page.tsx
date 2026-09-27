"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HallList } from "@/components/HallList";
import { HoursPanel } from "@/components/HoursPanel";
import { MenuList } from "@/components/MenuList";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { dayOfMonth, formatDate, shortWeekday } from "@/lib/dates";
import { HALLS, hallBySlug, type Hall } from "@/lib/halls";
import { campusNow, dowOf, mealLabel, mealNow, type CampusTime } from "@/lib/hours";
import { useMenuData, type MenuStatus } from "@/lib/menuData";
import { searchMenus } from "@/lib/search";
import { MEALS, type DayMenu, type Meal, type MenuData } from "@/lib/types";

const APP_NAME = "Ham Eats";

// The selected hall lives in the URL hash (#commons) so the browser back button returns home.
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const useHash = () =>
  useSyncExternalStore(
    subscribeHash,
    () => window.location.hash.slice(1),
    () => "",
  );

function goHome() {
  // Drop the hash entirely rather than leaving a bare "#".
  history.pushState(null, "", window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  window.scrollTo({ top: 0 });
}

/** Campus clock, ticking every minute so open/closed and the current meal stay right. */
function useCampusNow() {
  const [now, setNow] = useState(() => campusNow());
  useEffect(() => {
    const id = setInterval(() => setNow(campusNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Fallback when a hall has no more service today: go by the time of day. */
function mealByClock(minutes: number): Meal {
  if (minutes < 10 * 60 + 30) return "Breakfast";
  if (minutes < 16 * 60) return "Lunch";
  return "Dinner";
}

const hasMenu = (day: DayMenu | undefined, hall: Hall, meal: Meal) =>
  Object.keys(day?.[hall.name]?.[meal] ?? {}).length > 0;

/** Start from `preferred`; if that meal has no menu, take the next meal that does (then earlier ones). */
function withMenu(preferred: Meal, day: DayMenu | undefined, hall: Hall): Meal {
  const i = MEALS.indexOf(preferred);
  const order = [...MEALS.slice(i), ...MEALS.slice(0, i).reverse()];
  return order.find((m) => hasMenu(day, hall, m)) ?? preferred;
}

function greeting(minutes: number) {
  if (minutes >= 5 * 60 && minutes < 12 * 60) return "Good Morning ☀️";
  if (minutes >= 12 * 60 && minutes < 17 * 60) return "Good Afternoon 🌤️";
  return "Good Evening 🌙";
}

const isPosted = (day: DayMenu | undefined) => !!day && Object.values(day).some((meals) => Object.keys(meals).length > 0);

const STATUS_LABEL: Record<MenuStatus, string> = {
  loading: "Loading…",
  cached: "Cached · checking for updates",
  fresh: "Menus up to date",
  offline: "Offline · showing saved menu",
  error: "Couldn't load menu",
};

const STATUS_DOT: Record<MenuStatus, string> = {
  loading: "bg-zinc-400",
  cached: "bg-amber-400",
  fresh: "bg-green-500",
  offline: "bg-amber-500",
  error: "bg-red-500",
};

function HomeView({ data, now }: { data: MenuData; now: CampusTime }) {
  const [query, setQuery] = useState("");
  const dates = useMemo(() => Object.keys(data.dates).sort(), [data]);
  const results = useMemo(() => searchMenus(data, dates, query), [data, dates, query]);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <h1 className="py-4 text-center text-3xl font-bold tracking-tight">{APP_NAME}</h1>
      </header>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <h2 className="text-3xl font-bold">{greeting(now.minutes)}</h2>
        <SearchBar onSearch={setQuery} />
        {query.trim() ? (
          <SearchResults rows={results} query={query} week />
        ) : (
          <section className="space-y-3">
            <h2 className="text-2xl font-bold">All Dining Halls</h2>
            <HallList halls={HALLS} now={now} />
          </section>
        )}
      </main>
    </>
  );
}

function HallView({ hall, data, now }: { hall: Hall; data: MenuData; now: CampusTime }) {
  const dates = useMemo(() => Object.keys(data.dates).sort(), [data]);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [pickedMeal, setPickedMeal] = useState<Meal | null>(null);

  const today = now.iso;
  // Default to today, or the next day this hall has a menu (e.g. a hall that's closed on weekends).
  const servesOn = (d: string) => MEALS.some((m) => hasMenu(data.dates[d], hall, m));
  const defaultDate = dates.find((d) => d >= today && servesOn(d)) ?? (dates.includes(today) ? today : dates[0]);
  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : defaultDate;
  const day = date ? data.dates[date] : undefined;
  const dow = date ? dowOf(date) : now.dow;

  // Today: whatever the hall is serving now (or next). Other days: the first meal with a menu.
  const autoMeal = withMenu(
    date === today ? (mealNow(hall.hours, now) ?? mealByClock(now.minutes)) : "Breakfast",
    day,
    hall,
  );
  const meal = pickedMeal ?? autoMeal;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto grid max-w-2xl grid-cols-[5.5rem_1fr_5.5rem] items-center px-2 py-2">
          <button
            onClick={goHome}
            aria-label="Back to all dining halls"
            className="flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-base font-medium hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-6">
              <path
                fillRule="evenodd"
                d="M12.8 5.2a.75.75 0 0 1 0 1.06L9.06 10l3.74 3.74a.75.75 0 1 1-1.06 1.06L7.47 10.53a.75.75 0 0 1 0-1.06l4.27-4.27a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            Home
          </button>
          <h1 className="truncate text-center text-lg font-bold">{hall.name}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <HoursPanel hours={hall.hours} now={now} />

        <div className="grid grid-cols-7 gap-1" role="group" aria-label="Day">
          {dates.map((d) => (
            <button
              key={d}
              onClick={() => {
                setPickedDate(d);
                setPickedMeal(null);
              }}
              aria-pressed={d === date}
              className={`flex flex-col items-center rounded-xl py-2 ${
                d === date ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
              } ${isPosted(data.dates[d]) ? "" : "opacity-40"}`}
            >
              <span className="text-xs">{d === today ? "Today" : shortWeekday(d)}</span>
              <span className="text-2xl font-bold tabular-nums">{dayOfMonth(d)}</span>
            </button>
          ))}
        </div>

        <div role="tablist" aria-label="Meal" className="flex border-b border-zinc-200 dark:border-zinc-800">
          {MEALS.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={m === meal}
              onClick={() => setPickedMeal(m)}
              className={`-mb-px flex-1 border-b-2 py-2.5 text-base ${
                m === meal
                  ? "border-zinc-900 font-semibold dark:border-white"
                  : `border-transparent text-zinc-500 ${hasMenu(day, hall, m) ? "" : "opacity-50"}`
              }`}
            >
              {mealLabel(hall.hours, dow, m)}
            </button>
          ))}
        </div>

        {date && <p className="text-sm text-zinc-500">{formatDate(date)}</p>}
        <MenuList
          stations={day?.[hall.name]?.[meal]}
          stationOrder={hall.stationOrder}
          emptyText={`No ${mealLabel(hall.hours, dow, meal).toLowerCase()} menu posted for this day.`}
          note={hall.slug === "diner" ? "The Diner mostly posts PDF menus." : undefined}
        />
      </main>
    </>
  );
}

export default function Home() {
  const { data, status, generatedAt, refresh } = useMenuData();
  const hall = hallBySlug(useHash());
  const now = useCampusNow();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex-1">
        {/* Rendered client-side only: open/closed and the current meal depend on the viewer's clock. */}
        {!data ? (
          <p className="py-20 text-center text-zinc-500">
            {status === "error" ? "Couldn't load menus. Try Refresh below." : "Loading menus…"}
          </p>
        ) : hall ? (
          <HallView key={hall.slug} hall={hall} data={data} now={now} />
        ) : (
          <HomeView data={data} now={now} />
        )}
      </div>

      <footer className="mx-auto w-full max-w-2xl space-y-2 px-4 py-6 text-xs text-zinc-500">
        <div className="flex items-center justify-between gap-3">
          <span
            className="flex items-center gap-1.5"
            title={generatedAt ? `Updated ${new Date(generatedAt).toLocaleString()}` : undefined}
          >
            <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
            {STATUS_LABEL[status]}
          </span>
          <button
            onClick={refresh}
            className="rounded-md border border-zinc-300 px-2 py-1 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Refresh
          </button>
        </div>
        <p>Unofficial student project, not affiliated with the college. Menus and hours can change.</p>
      </footer>
    </div>
  );
}
