"use client";

import { useEffect } from "react";
import type { MenuItem } from "@/lib/types";

/** Where a food was opened from: a hall slug, and the day and meal when known. */
export type ReviewPlace = { hall: string; date: string | null; meal: string | null };
import { track } from "@/lib/analytics";
import { lockScroll } from "@/lib/scrollLock";
import { CommentPill, VoteButtons } from "@/components/VoteButtons";
import { Reviews } from "@/components/Reviews";
import { FavoriteButton } from "@/components/FavoriteButton";

/** Full-screen page for one food: its name with thumbs up and down underneath, a Google search link, and what students have written about it. */
export function ItemSheet({
  item,
  context,
  place,
  onClose,
}: {
  item: MenuItem;
  /** e.g. "Spoon & Fork · Lunch" */
  context: string;
  /** The hall, day and meal the food was opened from, saved with a review so it shows that hall's flair in the Feed. */
  place?: ReviewPlace;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Keep the menu underneath from scrolling while the sheet is open.
    const unlock = lockScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full overflow-y-auto bg-background text-zinc-900 sm:h-auto sm:max-h-full sm:max-w-lg sm:rounded-xl dark:text-zinc-100"
      >
        <div className="sticky top-0 z-10 bg-background px-2 py-2">
          <button
            onClick={onClose}
            autoFocus
            className="flex min-h-11 items-center gap-0.5 rounded-md px-2 text-base font-medium hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-6">
              <path
                fillRule="evenodd"
                d="M12.8 5.2a.75.75 0 0 1 0 1.06L9.06 10l3.74 3.74a.75.75 0 1 1-1.06 1.06L7.47 10.53a.75.75 0 0 1 0-1.06l4.27-4.27a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </button>
        </div>

        <div className="space-y-6 px-5 pb-10">
          <header className="space-y-2">
            <p className="text-sm text-zinc-500">{context}</p>
            <h2 className="text-3xl font-bold leading-tight">{item.name}</h2>
            <FavoriteButton dish={item.name} source="item_sheet" size="lg" />
            <div className="flex items-center gap-2">
              <VoteButtons dish={item.name} size="lg" />
              <CommentPill
                dish={item.name}
                size="lg"
                onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" })}
              />
            </div>
          </header>

          {/* Opens in the phone's browser (a new tab on desktop) so people can see what the food looks like. */}
          <p className="text-center">
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(item.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("item_google_search", { item: item.name })}
              className="text-base font-medium text-accent underline underline-offset-4"
            >
              Google search
            </a>
          </p>

          <Reviews dish={item.name} place={place} />

          <p className="text-xs text-zinc-500">For allergen and ingredient information, please ask dining staff.</p>
        </div>
      </div>
    </div>
  );
}
