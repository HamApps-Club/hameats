"use client";

import { useMemo, useState } from "react";
import type { CampusTime } from "@/lib/hours";
import type { MenuData } from "@/lib/types";
import { useFavorites } from "@/lib/favorites";
import { dayLabel, servingsOf, weekDishes, type Serving } from "@/lib/upcoming";
import { useItemSheet } from "@/components/home/NetNutritionHomeLayout";
import { FavoriteButton, StarIcon } from "@/components/FavoriteButton";
import { track } from "@/lib/analytics";

/**
 * Favorites: the dishes you starred, each with when and where it's next served this week, soonest first. Dishes not on
 * any menu this week are listed underneath so they're easy to unstar. Saved on this device, so there's no account.
 */
export function FavoritesTab({ data, now }: { data: MenuData; now: CampusTime }) {
  const { favorites } = useFavorites();
  const { open, sheet } = useItemSheet();

  const rows = useMemo(
    () => favorites.map((dish) => ({ dish, servings: servingsOf(dish, data, now) })),
    [favorites, data, now],
  );
  const upcoming = rows.filter((r) => r.servings.length > 0).sort((a, b) => key(a.servings[0]).localeCompare(key(b.servings[0])));
  const notThisWeek = rows.filter((r) => r.servings.length === 0);

  const openServing = (s: Serving) =>
    open({ item: s.item, context: `${s.hall.name} · ${s.station} · ${s.meal}`, place: { hall: s.hall.slug, date: s.date, meal: s.meal } });

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-12 pt-5">
      {favorites.length === 0 ? (
        <section className="rounded-[10px] border border-rule bg-surface p-5 text-center">
          <StarIcon filled={false} className="mx-auto size-9 text-gold-ink dark:text-gold" />
          <h2 className="mt-2 font-display text-2xl font-bold">Never miss your favorites</h2>
          <p className="mt-1.5 text-[15px] text-muted">
            Star the dishes you love and this page shows when and where each one is served next. Search below, or tap a
            dish on the menu and choose Save to Favorites.
          </p>
        </section>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Coming up</h2>
              {upcoming.map(({ dish, servings }) => (
                <article key={dish} className="rounded-[10px] border border-rule bg-surface p-4 pr-2 shadow-[0_8px_20px_-14px] shadow-black/20">
                  <div className="flex items-start gap-1">
                    <button onClick={() => openServing(servings[0])} className="min-w-0 flex-1 text-left">
                      <h3 className="text-[17px] font-semibold leading-snug">{servings[0].item.name}</h3>
                    </button>
                    <FavoriteButton dish={dish} source="favorites_tab" />
                  </div>
                  <ul className="mt-1 space-y-1.5 pr-2">
                    {servings.slice(0, 3).map((s, i) => (
                      <li key={`${s.date}-${s.hall.slug}-${s.meal}`}>
                        <button onClick={() => openServing(s)} className="flex w-full flex-wrap items-baseline gap-x-2 text-left text-[15px]">
                          <span className={i === 0 && s.date === now.iso ? "rounded bg-gold px-1.5 py-0.5 text-[13px] font-bold text-zinc-950" : "font-semibold"}>
                            {dayLabel(s.date, now.iso)}
                          </span>
                          <span>
                            {s.hall.name} · {s.meal}
                          </span>
                          {s.hours && <span className="text-muted">{s.hours}</span>}
                        </button>
                      </li>
                    ))}
                    {servings.length > 3 && <li className="text-sm text-muted">+{servings.length - 3} more this week</li>}
                  </ul>
                </article>
              ))}
            </section>
          )}

          {notThisWeek.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Not being served this week</h2>
              <ul className="divide-y divide-rule/70 rounded-[10px] border border-rule bg-surface px-4">
                {notThisWeek.map(({ dish }) => (
                  <li key={dish} className="flex items-center gap-2 py-1 pr-0">
                    <span className="min-w-0 flex-1 text-[15px] text-muted">{dish}</span>
                    <FavoriteButton dish={dish} source="favorites_tab" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <DishSearch data={data} now={now} />
      {sheet}
    </main>
  );
}

/** Soonest first: by date, then meal order, then hall. */
const key = (s: Serving) => `${s.date}-${["Breakfast", "Lunch", "Dinner"].indexOf(s.meal)}-${s.hall.slug}`;

/** Search this week's dishes and star them. */
function DishSearch({ data, now }: { data: MenuData; now: CampusTime }) {
  const [query, setQuery] = useState("");
  const dishes = useMemo(() => weekDishes(data, now), [data, now]);
  const q = query.trim().toLowerCase();
  const matches = q.length >= 2 ? dishes.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 25) : [];

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Add a favorite</h2>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => q && track("favorites_searched", { query: q, results: matches.length })}
        placeholder="Search this week's dishes"
        aria-label="Search this week's dishes"
        className="min-h-11 w-full rounded-lg border border-rule bg-surface px-3.5 text-base outline-none placeholder:text-muted focus:border-accent"
      />
      {q.length >= 2 &&
        (matches.length > 0 ? (
          <ul className="divide-y divide-rule/70 rounded-[10px] border border-rule bg-surface px-4">
            {matches.map((d) => (
              <li key={d.name} className="flex items-center gap-2 py-1">
                <span className="min-w-0 flex-1 text-[15px]">{d.name}</span>
                <FavoriteButton dish={d.name} source="favorites_search" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-sm text-muted">Nothing called that is on the menu this week.</p>
        ))}
    </section>
  );
}
