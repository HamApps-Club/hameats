"use client";

import { useFavorites } from "@/lib/favorites";
import { FavoriteButton, StarIcon } from "@/components/FavoriteButton";

/** The Favorites on your Profile: one card per saved dish, with its name and the star to remove it. */
export function FavoritesPanel() {
  const { favorites, status } = useFavorites();

  if (status !== "ready")
    return (
      <p className="py-12 text-center text-muted">
        {status === "error" ? "Couldn't load your favorites. Check your connection and try again." : "Loading…"}
      </p>
    );

  if (favorites.length === 0)
    return (
      <section className="rounded-[10px] border border-rule bg-surface p-5 text-center">
        <StarIcon filled={false} className="mx-auto size-9 text-gold-ink dark:text-gold" />
        <h2 className="mt-2 font-display text-2xl font-bold">No favorites yet</h2>
        <p className="mt-1.5 text-[15px] text-muted">Tap a dish on the Menu and choose Save to Favorites.</p>
      </section>
    );

  return (
    <ul className="space-y-2.5">
      {favorites.map((dish) => (
        <li key={dish} className="flex items-center gap-2 rounded-[10px] border border-rule bg-surface py-1.5 pl-4 pr-1.5 shadow-[0_8px_20px_-14px] shadow-black/20">
          <span className="min-w-0 flex-1 text-[17px] font-semibold leading-snug">{dish}</span>
          <FavoriteButton dish={dish} source="profile" />
        </li>
      ))}
    </ul>
  );
}
