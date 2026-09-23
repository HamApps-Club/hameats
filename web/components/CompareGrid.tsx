import type { DayMenu, MealMenu, MenuItem } from "@/lib/types";
import { Tags } from "./Tags";

function StationCard({ station, items, compact }: { station: string; items: MenuItem[]; compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-sm leading-snug">
        <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 dark:text-red-400">{station}</span>
        {items.map((it) => it.name).join(" · ")}
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-800 dark:text-red-400">{station}</h3>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.name} className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span>{it.name}</span>
            <span className="flex items-center gap-2">
              <Tags tags={it.tags.filter((t) => t === "Vegan" || t === "Vegetarian")} />
              {it.calories != null && <span className="text-xs tabular-nums text-zinc-400">{Math.round(it.calories)} cal</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LocationColumn({
  name,
  meal,
  stations,
  compact,
}: {
  name: string;
  meal: string;
  stations?: MealMenu;
  compact?: boolean;
}) {
  const entries = stations ? Object.entries(stations) : [];
  const count = entries.reduce((n, [, items]) => n + items.length, 0);
  return (
    <section className="min-w-0">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className={compact ? "font-semibold" : "text-lg font-semibold"}>{name}</h2>
        {count > 0 && <span className="text-xs text-zinc-500">{count} items</span>}
      </header>
      {entries.length ? (
        <div
          className={
            compact
              ? "space-y-1.5 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              : "space-y-3"
          }
        >
          {entries.map(([station, items]) => (
            <StationCard key={station} station={station} items={items} compact={compact} />
          ))}
        </div>
      ) : (
        <div
          className={`rounded-lg border border-dashed border-zinc-300 text-center text-sm text-zinc-500 dark:border-zinc-700 ${
            compact ? "p-3" : "p-6"
          }`}
        >
          Not serving {meal}
          {name === "Howard Diner" && <span className="block text-xs">(the Diner mostly posts PDF menus)</span>}
        </div>
      )}
    </section>
  );
}

export function CompareGrid({
  day,
  meal,
  locations,
  compact,
}: {
  day: DayMenu | undefined;
  meal: string;
  locations: string[];
  compact?: boolean;
}) {
  const cols = locations.length === 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2";
  return (
    <div className={`grid grid-cols-1 ${compact ? "gap-3" : "gap-6"} ${cols}`}>
      {locations.map((loc) => (
        <LocationColumn key={loc} name={loc} meal={meal} stations={day?.[loc]?.[meal]} compact={compact} />
      ))}
    </div>
  );
}
