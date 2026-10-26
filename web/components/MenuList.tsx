import { CommentPill, VoteButtons } from "@/components/VoteButtons";
import { orderedStations } from "@/lib/halls";
import { sortByRank, useVotes } from "@/lib/likes";
import type { MealMenu, MenuItem } from "@/lib/types";

/** One food as a Classic-style card. Tap it to open its page. */
export function ItemCard({ item, onSelect }: { item: MenuItem; onSelect: () => void }) {
  return (
    <div className="flex w-full items-center gap-1 rounded-xl border border-zinc-200 bg-white pr-2 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-surface dark:hover:border-zinc-700">
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left active:scale-[0.99]">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-base font-medium">{item.name}</p>
        </div>
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-5 shrink-0 text-zinc-400">
          <path
            fillRule="evenodd"
            d="M7.2 14.8a.75.75 0 0 1 0-1.06L10.94 10 7.2 6.26a.75.75 0 1 1 1.06-1.06l4.27 4.27a.75.75 0 0 1 0 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <VoteButtons dish={item.name} />
      <CommentPill dish={item.name} onClick={onSelect} />
    </div>
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
  const { rank } = useVotes();
  // Within each station, the dishes with the most thumbs ups come first.
  const entries = orderedStations(stations, stationOrder).map(([station, items]): [string, MenuItem[]] => [
    station,
    sortByRank(items, rank),
  ]);
  if (!entries.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
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
    </div>
  );
}
