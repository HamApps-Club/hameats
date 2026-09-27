import type { Hall } from "@/lib/halls";
import { statusAt, summaryParts, type CampusTime } from "@/lib/hours";
import { StatusLine } from "./HoursPanel";

export function HallList({ halls, now }: { halls: Hall[]; now: CampusTime }) {
  return (
    <nav aria-label="Dining halls" className="space-y-3">
      {halls.map((h) => {
        const today = h.hours[now.dow];
        return (
          <a
            key={h.slug}
            href={`#${h.slug}`}
            onClick={() => window.scrollTo({ top: 0 })}
            className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <h3 className="text-xl font-semibold">{h.name}</h3>
              <StatusLine status={statusAt(h.hours, now)} caps />
              {today.length ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-sm tabular-nums text-zinc-500">
                  {summaryParts(today).map((part) => (
                    <div key={part.name} className="contents">
                      <dt>{part.name}</dt>
                      <dd>{part.hours}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-zinc-500">Closed today</p>
              )}
            </div>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-5 shrink-0 text-zinc-400">
              <path
                fillRule="evenodd"
                d="M7.2 14.8a.75.75 0 0 1 0-1.06L10.94 10 7.2 6.26a.75.75 0 1 1 1.06-1.06l4.27 4.27a.75.75 0 0 1 0 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        );
      })}
    </nav>
  );
}
