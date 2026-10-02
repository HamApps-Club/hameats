"use client";

import { dayOfMonth, shortWeekday } from "@/lib/dates";

/** Row of day buttons (Today, Tue 29, …) for the week of menus we have. */
export function DayPicker({
  dates,
  selected,
  today,
  onSelect,
  isDimmed,
}: {
  dates: string[];
  selected: string | undefined;
  today: string;
  onSelect: (date: string) => void;
  /** Days drawn faded, e.g. with no menu posted. */
  isDimmed?: (date: string) => boolean;
}) {
  return (
    <div className="grid grid-cols-7 gap-1" role="group" aria-label="Day">
      {dates.map((d) => (
        <button
          key={d}
          onClick={() => onSelect(d)}
          aria-pressed={d === selected}
          className={`flex flex-col items-center rounded-xl py-2 ${
            d === selected
              ? "bg-accent text-white"
              : "hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          } ${isDimmed?.(d) ? "opacity-40" : ""}`}
        >
          <span className="text-xs">{d === today ? "Today" : shortWeekday(d)}</span>
          <span className="text-2xl font-bold tabular-nums">{dayOfMonth(d)}</span>
        </button>
      ))}
    </div>
  );
}
