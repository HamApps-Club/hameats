"use client";

import { useState } from "react";
import { addDays, clock, dayHours, mealNow, range, statusAt, type CampusTime, type Status, type WeekHours } from "@/lib/hours";
import { MEALS, type Meal } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function statusText(s: Status) {
  if (s.open) return `until ${clock(s.closesAt)}`;
  return s.opens ? `opens ${s.opens}` : "no hours posted";
}

/** "OPEN · until 2 PM" in green, or "CLOSED · opens 5 PM" in gray. */
export function StatusLine({ status, caps }: { status: Status; caps?: boolean }) {
  return (
    <p className="text-sm">
      <span
        className={`font-semibold ${caps ? "uppercase tracking-wide" : ""} ${
          status.open ? "rounded-full bg-gold px-2 py-0.5 text-zinc-950" : "text-zinc-500"
        }`}
      >
        {status.open ? "Open" : "Closed"}
      </span>
      <span className="text-zinc-500"> · {statusText(status)}</span>
    </p>
  );
}

/** Open/closed now; tap to expand the week's hours for each meal. */
export function HoursPanel({ hours, now }: { hours: WeekHours; now: CampusTime }) {
  const [expanded, setExpanded] = useState(false);
  const meals = MEALS.filter((m) => hours.some((day) => day.some((x) => x.meal === m)));
  // Tab label: the service's own name when every window of that meal shares one ("Pub", "Lunch Buffet").
  const tabLabel = (m: Meal) => {
    const names = new Set(hours.flatMap((day) => day.filter((x) => x.meal === m).map((x) => x.name)));
    return names.size === 1 ? [...names][0] : m;
  };
  const [meal, setMeal] = useState<Meal>(() => mealNow(hours, now) ?? meals[0]);
  const status = statusAt(hours, now);
  // Sunday through Saturday of this week, by real date, so break-week changes show on the right days.
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(now.iso, i - now.dow));
  const hasChanges = weekDates.some((d) => hours.overrides?.[d]);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-surface">
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <StatusLine status={status} />
          <p className="text-sm text-zinc-500">Tap to {expanded ? "hide" : "view"} hours</p>
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          className={`size-5 shrink-0 text-zinc-400 transition ${expanded ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div role="tablist" aria-label="Meal" className="flex rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800">
            {meals.map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={m === meal}
                onClick={() => setMeal(m)}
                className={`flex-1 rounded py-1.5 text-sm font-medium ${
                  m === meal ? "bg-white shadow-sm dark:bg-background" : "text-zinc-500"
                }`}
              >
                {tabLabel(m)}
              </button>
            ))}
          </div>
          <table className="w-full text-sm">
            <tbody>
              {weekDates.map((date, dow) => {
                const periods = dayHours(hours, date).filter((x) => x.meal === meal);
                return (
                  <tr key={date} className={`align-top ${dow === now.dow ? "font-semibold" : ""}`}>
                    <th scope="row" className="w-14 py-1 text-left font-inherit">
                      {DAYS[dow]}
                    </th>
                    <td className="py-1 tabular-nums">
                      {periods.length ? (
                        periods.map((x, i) => (
                          <span key={x.name} className={i ? "block text-xs font-normal text-zinc-500" : "block"}>
                            {i || x.name !== meal ? `${x.name} ` : ""}
                            {range(x.open, x.close)}
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-400">Closed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-zinc-500">
            {hasChanges ? "Fall Break hours (Oct 14–18) are shown. " : ""}Hours can change during breaks and holidays.
          </p>
        </div>
      )}
    </section>
  );
}
