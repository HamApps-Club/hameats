import { orderedStations } from "@/lib/halls";
import type { MealMenu, MenuItem } from "@/lib/types";
import { IconLegend, Tags } from "./Tags";

/** "183 calories · 6g protein · 33g carbs" — whatever is known. */
function macroLine(it: MenuItem) {
  const n = it.nutrition;
  return [
    it.calories != null && `${Math.round(it.calories)} calories`,
    n?.protein != null && `${Math.round(n.protein)}g protein`,
    n?.carbs != null && `${Math.round(n.carbs)}g carbs`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** One food as a Classic-style card: name, calories/protein/carbs, and diet tags. */
export function ItemCard({ item, onSelect }: { item: MenuItem; onSelect: () => void }) {
  const macros = macroLine(item);
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-300 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-base font-medium">{item.name}</p>
        {macros && <p className="text-sm tabular-nums text-zinc-500">{macros}</p>}
        <Tags tags={item.tags} />
      </div>
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-5 shrink-0 text-zinc-400">
        <path
          fillRule="evenodd"
          d="M7.2 14.8a.75.75 0 0 1 0-1.06L10.94 10 7.2 6.26a.75.75 0 1 1 1.06-1.06l4.27 4.27a.75.75 0 0 1 0 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

/** One hall's stations for one meal. Stations collapse; tap a food to open its page. */
export function MenuList({
  stations,
  stationOrder,
  emptyText,
  note,
  onSelect,
}: {
  stations: MealMenu | undefined;
  stationOrder?: string[];
  emptyText: string;
  note?: React.ReactNode;
  onSelect: (item: MenuItem, station: string) => void;
}) {
  const entries = orderedStations(stations, stationOrder);
  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
        <p>{emptyText}</p>
        {note && <div className="mt-2 text-sm">{note}</div>}
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {entries.map(([station, items]) => (
        <details key={station} open className="group">
          <summary className="mb-3 flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
            <h3 className="text-xl font-bold">{station}</h3>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
              className="size-5 text-zinc-400 transition group-open:rotate-180"
            >
              <path
                fillRule="evenodd"
                d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </summary>
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.name}>
                <ItemCard item={it} onSelect={() => onSelect(it, station)} />
              </li>
            ))}
          </ul>
        </details>
      ))}
      <IconLegend />
    </div>
  );
}
