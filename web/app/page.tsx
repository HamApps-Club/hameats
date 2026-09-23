"use client";

import { useMemo, useState } from "react";
import { CompareGrid } from "@/components/CompareGrid";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { useMenuData, type MenuStatus } from "@/lib/menuData";
import { searchDay } from "@/lib/search";
import { MEALS, type Meal } from "@/lib/types";

function localISODate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMeal(d = new Date()): Meal {
  const mins = d.getHours() * 60 + d.getMinutes();
  if (mins < 10 * 60 + 30) return "Breakfast";
  if (mins < 16 * 60) return "Lunch";
  return "Dinner";
}

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

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

export default function Home() {
  const { data, status, generatedAt, refresh } = useMenuData();
  const [query, setQuery] = useState("");
  const [meal, setMeal] = useState<Meal>(() => currentMeal());
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [showDiner, setShowDiner] = useState(false);

  const dates = useMemo(() => (data ? Object.keys(data.dates).sort() : []), [data]);
  const today = localISODate();
  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : dates.includes(today) ? today : dates.at(-1);
  const day = date ? data?.dates[date] : undefined;

  const results = useMemo(() => searchDay(day, query), [day, query]);
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
            <div className="flex flex-wrap items-center gap-2">
              {dates.length > 1 ? (
                <select
                  value={date}
                  onChange={(e) => setPickedDate(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {dates.map((d) => (
                    <option key={d} value={d}>
                      {formatDate(d)}
                    </option>
                  ))}
                </select>
              ) : (
                date && <span className="text-sm font-medium">{formatDate(date)}</span>
              )}
              {!searching && (
                <>
                  <div role="tablist" className="ml-auto flex rounded-lg bg-zinc-200/70 p-0.5 dark:bg-zinc-800">
                    {MEALS.map((m) => (
                      <button
                        key={m}
                        role="tab"
                        aria-selected={meal === m}
                        onClick={() => setMeal(m)}
                        className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                          meal === m ? "bg-white shadow-sm dark:bg-zinc-950" : "text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                    <input type="checkbox" checked={showDiner} onChange={(e) => setShowDiner(e.target.checked)} className="accent-red-800" />
                    Diner
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {!data ? (
          <p className="py-20 text-center text-zinc-500">
            {status === "error" ? "No menu data yet. Run python3 scraper/scrape_menu.py." : "Loading menus…"}
          </p>
        ) : searching ? (
          <SearchResults rows={results} query={query} />
        ) : (
          <CompareGrid day={day} meal={meal} locations={locations} />
        )}
      </main>
    </div>
  );
}
