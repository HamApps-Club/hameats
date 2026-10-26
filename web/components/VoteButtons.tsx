"use client";

import { useVotes } from "@/lib/likes";

/** The thumbs-up hand: an outline, filled in once you've chosen it. Flipped upside down, it's the thumbs down. */
function ThumbIcon({ filled, down, className }: { filled: boolean; down?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`${className ?? ""} ${down ? "-scale-y-100" : ""}`}
    >
      <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Z" />
      <path d="M7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 1.96 2.4l-1.4 7A2 2 0 0 1 17.1 20H7" />
    </svg>
  );
}

/**
 * A thumbs up, the dish's score (everybody's thumbs ups minus thumbs downs), and a thumbs down. Tap one to vote, and
 * tap it again to take the vote back (Google sign-in needed). Not shown when no database is connected.
 */
export function VoteButtons({ dish, size = "sm" }: { dish: string; size?: "sm" | "lg" }) {
  const { enabled, score, vote, cast } = useVotes();
  if (!enabled) return null;
  const mine = vote(dish);
  const total = score(dish);
  const lg = size === "lg";
  const button = (direction: 1 | -1) => {
    const on = mine === direction;
    const name = direction === 1 ? "Thumbs up" : "Thumbs down";
    return (
      <button
        type="button"
        onClick={() => cast(dish, direction)}
        aria-pressed={on}
        aria-label={on ? `Remove your ${name.toLowerCase()} from ${dish}` : `${name} ${dish}`}
        className={`flex shrink-0 items-center justify-center rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800 ${
          on ? "text-accent" : "text-muted"
        } ${lg ? "min-h-11 min-w-10" : "min-h-9 min-w-8"}`}
      >
        <ThumbIcon filled={on} down={direction === -1} className={lg ? "size-6" : "size-5"} />
      </button>
    );
  };
  return (
    <div className={`flex shrink-0 items-center ${lg ? "text-lg" : "text-sm"}`}>
      {button(1)}
      {/* Hidden at zero, but still takes up room, so the rows line up. */}
      <span
        aria-label={`Score ${total}`}
        className={`min-w-[2ch] text-center font-semibold tabular-nums text-muted ${total === 0 ? "invisible" : ""}`}
      >
        {total}
      </span>
      {button(-1)}
    </div>
  );
}
