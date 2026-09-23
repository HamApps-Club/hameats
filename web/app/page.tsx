"use client";

import { useMemo, useState } from "react";
import { CompareGrid } from "@/components/CompareGrid";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { dayOfMonth, formatDate, localISODate, shortWeekday } from "@/lib/dates";
import { useMenuData, type MenuStatus } from "@/lib/menuData";
import { searchMenus } from "@/lib/search";
import { MEALS, type DayMenu, type Meal } from "@/lib/types";

type View = "day" | "week";

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

export default function Home() {
  const { data, status, generatedAt, refresh } = useMenuData();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("day");
  const [meal, setMeal] = useState<Meal>(() => currentMeal());
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [showDiner, setShowDiner] = useState(false);

  const dates = useMemo(() => (data ? Object.keys(data.dates).sort() : []), [data]);
  const today = localISODate();
  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : dates.includes(today) ? today : dates.at(-1);

  const searchDates = useMemo(() => (view === "week" ? dates : date ? [date] : []), [view, dates, date]);
  const results = useMemo(() => searchMenus(data, searchDates, query), [data, searchDates, query]);
  const searching = query.trim().length > 0;
  const locations = showDiner
    ? ["Soper Commons", "McEwen Dining Hall", "Howard Diner"]
    : ["Soper Commons", "McEwen Dining Hall"];

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto max-w-6xl space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-red-800 dark:text-red-400">Hamilton</span> Dining
            </h1>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5" title={generatedAt ? `Scraped ${new Date(generatedAt).toLocaleString()}` : undefined}>
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
          </div>
          <SearchBar onSearch={setQuery} />
          {/* Rendered client-side only: the default meal depends on the viewer's clock, not build time. */}
          {data && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented label="View" options={VIEW_OPTIONS} value={view} onChange={setView} />
                {!searching && (
                  <>
                    <Segmented label="Meal" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
                    <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                      <input
                        type="checkbox"
                        checked={showDiner}
                        onChange={(e) => setShowDiner(e.target.checked)}
                        className="accent-red-800"
                      />
                      Diner
                    </label>
                  </>
                )}
              </div>
              {view === "day" && (
                <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
                  {dates.map((d) => (
                    <button
                      key={d}
                      onClick={() => setPickedDate(d)}
                      aria-pressed={d === date}
                      className={`flex w-12 shrink-0 flex-col items-center rounded-lg border py-1 text-xs ${
                        d === date
                          ? "border-red-800 bg-red-800 text-white dark:border-red-500 dark:bg-red-600"
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
        ) : view === "day" ? (
          <>
            {date && <h2 className="mb-4 text-lg font-semibold">{formatDate(date)}</h2>}
            {isPosted(date ? data.dates[date] : undefined) ? (
              <CompareGrid day={date ? data.dates[date] : undefined} meal={meal} locations={locations} />
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
                    <span className="rounded bg-red-800 px-1.5 py-0.5 text-xs font-medium text-white dark:bg-red-600">
                      Today
                    </span>
                  )}
                </h2>
                {isPosted(data.dates[d]) ? (
                  <CompareGrid day={data.dates[d]} meal={meal} locations={locations} compact />
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
