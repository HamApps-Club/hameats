"use client";

import { StatusLine } from "@/components/HoursPanel";
import { track } from "@/lib/analytics";
import { CAFES, type Cafe } from "@/lib/cafes";
import { addDays, dayHours, range, statusAt, type CampusTime } from "@/lib/hours";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** This week's hours, Sunday through Saturday by real date so break closures show on the right days. */
function WeekHoursList({ cafe, now }: { cafe: Cafe; now: CampusTime }) {
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(now.iso, i - now.dow));
  return (
    <table className="w-full text-sm">
      <tbody>
        {weekDates.map((date, dow) => {
          const periods = dayHours(cafe.hours, date);
          return (
            <tr key={date} className={dow === now.dow ? "font-semibold" : ""}>
              <th scope="row" className="w-14 py-0.5 text-left font-inherit">
                {DAYS[dow]}
              </th>
              <td className="py-0.5 tabular-nums">
                {periods.length ? (
                  periods.map((x) => range(x.open, x.close)).join(", ")
                ) : (
                  <span className="text-zinc-400">Closed</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-5 shrink-0 text-zinc-400 transition group-open:rotate-180">
      <path
        fillRule="evenodd"
        d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CafeCard({ cafe, now }: { cafe: Cafe; now: CampusTime }) {
  return (
    <section id={cafe.slug} className="scroll-mt-32 space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-surface">
      <header className="space-y-1">
        <h2 className="text-2xl font-bold">{cafe.name}</h2>
        <p className="text-sm text-zinc-500">{cafe.where}</p>
        <StatusLine status={statusAt(cafe.hours, now)} />
        <p className="pt-1 text-[15px]">{cafe.blurb}</p>
      </header>

      <details
        className="group"
        onToggle={(e) => e.currentTarget.open && track("cafe_hours_opened", { cafe: cafe.slug })}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden">
          This week&apos;s hours
          <Chevron />
        </summary>
        <div className="pt-2">
          <WeekHoursList cafe={cafe} now={now} />
          <p className="pt-2 text-xs text-zinc-500">Hours can change during breaks and holidays.</p>
        </div>
      </details>

      {cafe.menu ? (
        <div className="space-y-2">
          {Object.entries(cafe.menu).map(([category, items]) => (
            <details
              key={category}
              className="group rounded-lg border border-zinc-200 dark:border-zinc-800"
              onToggle={(e) => e.currentTarget.open && track("cafe_menu_opened", { cafe: cafe.slug, category })}
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 font-semibold [&::-webkit-details-marker]:hidden">
                {category}
                <Chevron />
              </summary>
              <ul className="space-y-3 border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
                {items.map((it) => (
                  <li key={it.name}>
                    <p className="font-medium">{it.name}</p>
                    {it.detail && <p className="text-sm text-zinc-500">{it.detail}</p>}
                  </li>
                ))}
              </ul>
            </details>
          ))}
          {cafe.note && <p className="pt-1 text-xs text-zinc-500">{cafe.note}</p>}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Menu coming soon.
        </p>
      )}

      <a href={cafe.site} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-accent underline underline-offset-4">
        {new URL(cafe.site).hostname.replace(/^www\./, "")}
      </a>
    </section>
  );
}

/** The Cafe tab: Euphoria and the two FoJo Beans, each with open/closed, this week's hours and its menu. */
export function CafeTab({ now }: { now: CampusTime }) {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-12 pt-5">
      {CAFES.map((cafe) => (
        <CafeCard key={cafe.slug} cafe={cafe} now={now} />
      ))}
    </main>
  );
}
