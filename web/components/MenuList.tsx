import { orderedStations } from "@/lib/halls";
import type { MealMenu, MenuItem, Nutrition } from "@/lib/types";
import { IconLegend, TagList, Tags } from "./Tags";

const NUTRIENT_LABELS: [keyof Nutrition, string, string][] = [
  ["protein", "Protein", "g"],
  ["carbs", "Carbs", "g"],
  ["fat", "Fat", "g"],
  ["sugar", "Sugar", "g"],
  ["fiber", "Fiber", "g"],
  ["sodium", "Sodium", "mg"],
];

function Details({ item }: { item: MenuItem }) {
  const facts = [
    item.serving && `Serving: ${item.serving}`,
    item.calories != null && `${Math.round(item.calories)} calories`,
    ...NUTRIENT_LABELS.filter(([k]) => item.nutrition?.[k] != null).map(
      ([k, label, unit]) => `${label} ${Math.round(item.nutrition![k]!)}${unit}`,
    ),
  ].filter(Boolean);
  const empty = !item.description && !facts.length && !item.tags.length && !item.ingredients;

  return (
    <div className="space-y-2 pb-3 pl-2 pr-1 text-sm text-zinc-600 dark:text-zinc-400">
      {item.description && <p>{item.description}</p>}
      {facts.length > 0 && <p className="tabular-nums">{facts.join(" · ")}</p>}
      {item.tags.length > 0 && <TagList tags={item.tags} />}
      {item.ingredients && (
        <p className="text-xs">
          <span className="font-medium">Ingredients:</span> {item.ingredients}
        </p>
      )}
      {empty && <p className="text-xs">No extra details posted for this item.</p>}
    </div>
  );
}

/** One hall's stations for one meal, as a single readable column. Tap a food for its details. */
export function MenuList({
  stations,
  stationOrder,
  emptyText,
  note,
}: {
  stations: MealMenu | undefined;
  stationOrder?: string[];
  emptyText: string;
  note?: React.ReactNode;
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
    <div className="space-y-8">
      {entries.map(([station, items]) => (
        <section key={station}>
          <h3 className="mb-2 text-xl font-bold">{station}</h3>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((it) => (
              <li key={it.name}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3 pl-2 [&::-webkit-details-marker]:hidden">
                    <span className="text-base">{it.name}</span>
                    <span className="flex items-center gap-2">
                      <Tags tags={it.tags} />
                      {it.calories != null && (
                        <span className="text-xs tabular-nums text-zinc-400">{Math.round(it.calories)} cal</span>
                      )}
                    </span>
                  </summary>
                  <Details item={it} />
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <IconLegend />
    </div>
  );
}
