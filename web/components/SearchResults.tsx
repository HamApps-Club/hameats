import { formatDate } from "@/lib/dates";
import type { SearchRow } from "@/lib/search";
import { MEALS } from "@/lib/types";
import { Highlight } from "./Highlight";
import { Tags } from "./Tags";

const mealOrder = (m: string) => MEALS.indexOf(m as (typeof MEALS)[number]);

function groupBy<T>(rows: T[], key: (r: T) => string) {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return map;
}

export function SearchResults({ rows, query, week }: { rows: SearchRow[]; query: string; week: boolean }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
        <p className="font-medium">
          No &ldquo;{query.trim()}&rdquo; on any menu {week ? "this week" : "this day"}.
        </p>
        <p className="mt-1 text-sm">Try a shorter word, like &ldquo;egg&rdquo; instead of &ldquo;eggs benedict&rdquo;.</p>
      </div>
    );
  }

  const byDate = groupBy([...rows].sort((a, b) => a.date.localeCompare(b.date)), (r) => r.date);
  const locationCount = new Set(rows.map((r) => r.location)).size;

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        {rows.length} match{rows.length === 1 ? "" : "es"} in {locationCount} location{locationCount === 1 ? "" : "s"}
        {week && ` across ${byDate.size} day${byDate.size === 1 ? "" : "s"}`}
      </p>
      {[...byDate].map(([date, dateRows]) => (
        <div key={date} className="space-y-3">
          {week && <h2 className="text-base font-semibold">{formatDate(date)}</h2>}
          {[...groupBy(dateRows, (r) => r.location)].map(([location, locRows]) => (
            <section key={location} className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="border-b border-zinc-200 px-4 py-2.5 font-semibold dark:border-zinc-800">{location}</h3>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {[...locRows]
                  .sort((a, b) => mealOrder(a.meal) - mealOrder(b.meal))
                  .map((r, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                      <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-yellow-300">
                        {r.meal}
                      </span>
                      <span className="font-medium">
                        <Highlight text={r.item.name} query={r.stationMatch ? "" : query} />
                      </span>
                      <span className="text-sm text-zinc-500">
                        @ <Highlight text={r.station} query={r.stationMatch ? query : ""} />
                      </span>
                      <Tags tags={r.item.tags} />
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}
