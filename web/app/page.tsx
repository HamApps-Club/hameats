"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { CompareGrid } from "@/components/CompareGrid";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { dayOfMonth, formatDate, localISODate, shortWeekday } from "@/lib/dates";
import { HALLS, THEME, hallBySlug, type Hall } from "@/lib/halls";
import { useMenuData, type MenuStatus } from "@/lib/menuData";
import { searchMenus } from "@/lib/search";
import { MEALS, type DayMenu, type Meal } from "@/lib/types";

type View = "day" | "week";

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

function currentMeal(d = new Date()): Meal {
  const mins = d.getHours() * 60 + d.getMinutes();
  if (mins < 10 * 60 + 30) return "Breakfast";
  if (mins < 16 * 60) return "Lunch";
  return "Dinner";
}

const isPosted = (day: DayMenu | undefined) => !!day && Object.values(day).some((meals) => Object.keys(meals).length > 0);

const STATUS_LABEL: Record<MenuStatus, string> = {
  loading: "Loading…",
  cached: "Cached · checking for updates",
  fresh: "Up to date",
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

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-lg bg-zinc-200/70 p-0.5 dark:bg-zinc-800">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm font-medium ${
            value === o.value ? "bg-white shadow-sm dark:bg-zinc-950" : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const VIEW_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
] as const;

const MEAL_OPTIONS = MEALS.map((m) => ({ value: m, label: m }));

function NotPosted() {
  return (
    <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
      Menus not posted yet
    </p>
  );
}

function HallButtons({ day, meal }: { day: DayMenu | undefined; meal: Meal }) {
  return (
    <nav aria-label="Dining halls" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {HALLS.map((h) => {
        const stations = day?.[h.name]?.[meal];
        const count = stations ? Object.values(stations).reduce((n, items) => n + items.length, 0) : 0;
        return (
          <a
            key={h.slug}
            href={`#${h.slug}`}
            onClick={() => window.scrollTo({ top: 0 })}
            className={`flex flex-col gap-1 rounded-2xl border-2 p-6 shadow-sm transition active:scale-[0.98] ${h.theme.button}`}
          >
            <span className="text-2xl font-bold">{h.short}</span>
            <span className="text-sm opacity-80">{h.name}</span>
            <span className="mt-2 text-sm font-medium">
              {count > 0 ? `${meal} today · ${count} items →` : `Not serving ${meal.toLowerCase()} today →`}
            </span>
          </a>
        );
      })}
    </nav>
  );
}

export default function Home() {
  const { data, status, generatedAt, refresh } = useMenuData();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("day");
  const [meal, setMeal] = useState<Meal>(() => currentMeal());
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const hall: Hall | undefined = hallBySlug(useHash());
  const theme = hall?.theme ?? THEME;

  const dates = useMemo(() => (data ? Object.keys(data.dates).sort() : []), [data]);
  const today = localISODate();
  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : dates.includes(today) ? today : dates.at(-1);

  const searchDates = useMemo(() => (view === "week" ? dates : date ? [date] : []), [view, dates, date]);
  const results = useMemo(() => searchMenus(data, searchDates, query), [data, searchDates, query]);
  const searching = query.trim().length > 0;
  const locations = hall ? [hall.name] : [];

  return (
    <div className={`min-h-full flex-1 text-zinc-900 dark:text-zinc-100 ${theme.page}`}>
      <header className={`sticky top-0 z-10 border-b backdrop-blur ${theme.header}`}>
        <div className="mx-auto max-w-6xl space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {hall ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={goHome}
                  aria-label="Back to home"
                  className={`flex min-h-11 items-center gap-1.5 rounded-xl border-2 px-4 text-base font-semibold shadow-sm ${hall.theme.selected}`}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-5">
                    <path d="M10.7 2.3a1 1 0 0 0-1.4 0l-7 7A1 1 0 0 0 3 11h1v6a1 1 0 0 0 1 1h3v-4h4v4h3a1 1 0 0 0 1-1v-6h1a1 1 0 0 0 .7-1.7l-7-7Z" />
                  </svg>
                  Home
                </button>
                <h1 className={`text-xl font-bold tracking-tight ${hall.theme.headerTitle}`}>{hall.name}</h1>
              </div>
            ) : (
              <h1 className="text-xl font-bold tracking-tight">
                <span className={theme.headerTitle}>Hamilton</span> <span className="text-white">Dining</span>
              </h1>
            )}
            <div className={`flex items-center gap-3 text-xs text-blue-100`}>
              <span className="flex items-center gap-1.5" title={generatedAt ? `Scraped ${new Date(generatedAt).toLocaleString()}` : undefined}>
                <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
                {STATUS_LABEL[status]}
              </span>
              <button
                onClick={refresh}
                className="rounded-md border border-current/30 px-2 py-1 font-medium hover:bg-black/5 dark:hover:bg-white/10"
              >
                Refresh
              </button>
            </div>
          </div>
          <SearchBar onSearch={setQuery} />
          {/* Rendered client-side only: the default meal depends on the viewer's clock, not build time. */}
          {data && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented label="View" options={VIEW_OPTIONS} value={view} onChange={setView} />
                {!searching && <Segmented label="Meal" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />}
              </div>
              {view === "day" && (hall || searching) && (
                <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
                  {dates.map((d) => (
                    <button
                      key={d}
                      onClick={() => setPickedDate(d)}
                      aria-pressed={d === date}
                      className={`flex w-12 shrink-0 flex-col items-center rounded-lg border py-1 text-xs ${
                        d === date
                          ? theme.selected
                          : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                      } ${isPosted(data.dates[d]) ? "" : "opacity-50"}`}
                    >
                      <span>{d === today ? "Today" : shortWeekday(d)}</span>
                      <span className="text-base font-semibold">{dayOfMonth(d)}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {!data ? (
          <p className="py-20 text-center text-zinc-500">
            {status === "error" ? "No menu data yet. Run python3 scraper/scrape_menu.py." : "Loading menus…"}
          </p>
        ) : searching ? (
          <SearchResults rows={results} query={query} week={view === "week"} />
        ) : !hall ? (
          <HallButtons day={data.dates[today]} meal={meal} />
        ) : view === "day" ? (
          <>
            {date && <h2 className="mb-4 text-lg font-semibold">{formatDate(date)}</h2>}
            {isPosted(date ? data.dates[date] : undefined) ? (
              <CompareGrid
                day={date ? data.dates[date] : undefined}
                meal={meal}
                locations={locations}
                theme={theme}
                stationOrder={hall.stationOrder}
              />
            ) : (
              <NotPosted />
            )}
          </>
        ) : (
          <div className="space-y-8">
            {dates.map((d) => (
              <section key={d}>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  {formatDate(d)}
                  {d === today && (
                    <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${theme.selected}`}>
                      Today
                    </span>
                  )}
                </h2>
                {isPosted(data.dates[d]) ? (
                  <CompareGrid
                    day={data.dates[d]}
                    meal={meal}
                    locations={locations}
                    theme={theme}
                    stationOrder={hall.stationOrder}
                    compact
                  />
                ) : (
                  <NotPosted />
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
