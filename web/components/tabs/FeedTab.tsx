"use client";

import { useMemo } from "react";
import { HALLS } from "@/lib/halls";
import { dayHours, summaryParts, statusAt, type CampusTime } from "@/lib/hours";
import { upcomingUpdates, type Update } from "@/lib/upcoming";
import { StatusLine } from "@/components/HoursPanel";

/**
 * The Feed: heads-ups written from the hours file and the specials list (closures, break hours, one-off dishes) for
 * the coming week, then every hall's open/closed status and today's hours. When the hours file or the specials list
 * changes, this page changes with it; nobody has to write a post.
 */
export function FeedTab({ now }: { now: CampusTime }) {
  const updates = useMemo(() => upcomingUpdates(now), [now]);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-12 pt-5">
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-accent">This week</h2>
        {updates.length > 0 ? (
          <ul className="space-y-2.5">
            {updates.map((u) => (
              <UpdateCard key={u.id} update={u} />
            ))}
          </ul>
        ) : (
          <p className="rounded-[10px] border border-rule bg-surface p-4 text-[15px] text-muted">
            All dining halls are on their regular hours this week.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Right now</h2>
        <ul className="divide-y divide-rule/70 rounded-[10px] border border-rule bg-surface px-4">
          {HALLS.map((hall) => {
            const today = summaryParts(dayHours(hall.hours, now.iso));
            return (
              <li key={hall.slug} className="py-3">
                <a href={`#${hall.slug}`} className="block space-y-1">
                  <h3 className="text-[17px] font-semibold">{hall.name}</h3>
                  <StatusLine status={statusAt(hall.hours, now)} />
                  <p className="text-sm text-muted">
                    {today.length > 0 ? today.map((x) => `${x.name} ${x.hours}`).join(" · ") : "Closed today"}
                  </p>
                </a>
              </li>
            );
          })}
        </ul>
        <p className="px-1 text-sm">
          <a href="/hours" className="font-medium text-accent underline underline-offset-4">
            Full weekly hours
          </a>
        </p>
      </section>
    </main>
  );
}

const ICON: Record<Update["kind"], string> = { closed: "Closed", hours: "Hours", special: "Special" };

function UpdateCard({ update }: { update: Update }) {
  return (
    <li className="flex gap-3 rounded-[10px] border border-rule bg-surface p-4 shadow-[0_8px_20px_-14px] shadow-black/20">
      <span
        className={`h-fit shrink-0 rounded px-2 py-1 text-[11px] font-bold uppercase leading-none tracking-[0.07em] ${
          update.kind === "special" ? "bg-gold text-zinc-950" : "bg-accent-fill text-on-accent"
        }`}
      >
        {ICON[update.kind]}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-[16px] font-semibold leading-snug">{update.title}</p>
        {update.lines.map((line) => (
          <p key={line} className="text-[15px] text-muted">
            {line}
          </p>
        ))}
      </div>
    </li>
  );
}
