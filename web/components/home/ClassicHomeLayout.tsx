"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HallList } from "@/components/HallList";
import { ItemSheet } from "@/components/ItemSheet";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { HALLS } from "@/lib/halls";
import type { CampusTime } from "@/lib/hours";
import { searchMenus } from "@/lib/search";
import type { MenuData, MenuItem } from "@/lib/types";
import { track } from "@/lib/analytics";

type Selected = { item: MenuItem; context: string };

/**
 * The food detail page. Opening it adds a history entry, so the phone's back
 * gesture (or browser Back) closes it instead of leaving the hall.
 */
function useItemSheet() {
  const [selected, setSelected] = useState<Selected | null>(null);
  useEffect(() => {
    const onPop = () => setSelected(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const open = useCallback((s: Selected) => {
    history.pushState({ itemSheet: true }, "");
    setSelected(s);
    track("item_opened", { item: s.item.name, context: s.context });
  }, []);
  const close = useCallback(() => {
    if (history.state?.itemSheet) history.back();
    else setSelected(null);
  }, []);
  const sheet = selected && <ItemSheet item={selected.item} context={selected.context} onClose={close} />;
  return { open, sheet };
}

function greeting(minutes: number) {
  if (minutes >= 5 * 60 && minutes < 12 * 60) return "Good Morning ☀️";
  if (minutes >= 12 * 60 && minutes < 17 * 60) return "Good Afternoon 🌤️";
  return "Good Evening 🌙";
}

export type HomeLayoutProps = { data: MenuData; now: CampusTime };

export function ClassicHomeLayout({ data, now }: HomeLayoutProps) {
  const [query, setQuery] = useState("");
  const dates = useMemo(() => Object.keys(data.dates).sort(), [data]);
  const results = useMemo(() => searchMenus(data, dates, query), [data, dates, query]);
  const { open, sheet } = useItemSheet();

  const handleSearch = useCallback(
    (q: string) => {
      if (q.trim() && !query.trim()) track("search_used");
      setQuery(q);
    },
    [query],
  );

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <h1 className="py-4 text-center text-3xl font-bold tracking-tight">
          <span className="text-blue-600 dark:text-blue-400">Ham</span> Eats
        </h1>
      </header>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <h2 className="text-3xl font-bold">{greeting(now.minutes)}</h2>
        <SearchBar onSearch={handleSearch} />
        {query.trim() ? (
          <SearchResults
            rows={results}
            query={query}
            week
            onSelect={(r) => open({ item: r.item, context: `${r.location} · ${r.station} · ${r.meal}` })}
          />
        ) : (
          <section className="space-y-3">
            <h2 className="text-2xl font-bold">All Dining Halls</h2>
            <HallList halls={HALLS} now={now} />
          </section>
        )}
      </main>
      {sheet}
    </>
  );
}
