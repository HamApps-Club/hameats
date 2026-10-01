"use client";

import { HallList } from "@/components/HallList";
import { HALLS } from "@/lib/halls";
import type { CampusTime } from "@/lib/hours";
import type { MenuData } from "@/lib/types";

function greeting(minutes: number) {
  if (minutes >= 5 * 60 && minutes < 12 * 60) return "Good Morning ☀️";
  if (minutes >= 12 * 60 && minutes < 17 * 60) return "Good Afternoon 🌤️";
  return "Good Evening 🌙";
}

export type HomeLayoutProps = { data: MenuData; now: CampusTime };

export function ClassicHomeLayout({ now }: HomeLayoutProps) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        {/* On phones the title centers in the gap between the Switch Layout button and the theme toggle. */}
        <h1 className="py-4 pl-36 pr-14 text-center text-2xl font-bold tracking-tight sm:px-0 sm:text-3xl">
          <span className="text-accent">Ham</span>Eats
        </h1>
      </header>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <h2 className="text-3xl font-bold">{greeting(now.minutes)}</h2>
        <section className="space-y-3">
          <h2 className="text-2xl font-bold">All Dining Halls</h2>
          <HallList halls={HALLS} now={now} />
        </section>
      </main>
    </>
  );
}
