import { orderedStations } from "@/lib/halls";
import type { MealMenu } from "@/lib/types";
import { Tags } from "./Tags";

/** One hall's stations for one meal, as a single readable column. */
export function MenuList({
  stations,
  stationOrder,
  emptyText,
  note,
}: {
  stations: MealMenu | undefined;
  stationOrder?: string[];
  emptyText: string;
  note?: string;
}) {
  const entries = orderedStations(stations, stationOrder);
  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
        <p>{emptyText}</p>
        {note && <p className="mt-1 text-xs">{note}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-8">
      {entries.map(([station, items]) => (
        <section key={station}>
          <h3 className="mb-2 text-xl font-bold">{station}</h3>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((it) => (
              <li key={it.name} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3 pl-2">
                <span className="text-base">{it.name}</span>
                <span className="flex items-center gap-2">
                  <Tags tags={it.tags.filter((t) => t === "Vegan" || t === "Vegetarian")} />
                  {it.calories != null && (
                    <span className="text-xs tabular-nums text-zinc-400">{Math.round(it.calories)} cal</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
