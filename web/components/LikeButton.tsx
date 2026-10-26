"use client";

import { useLikes } from "@/lib/likes";

/** The thumbs-up hand: an outline, filled in once you've given one. */
function ThumbIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Z" />
      <path d="M7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 1.96 2.4l-1.4 7A2 2 0 0 1 17.1 20H7" />
    </svg>
  );
}

/** An empty thumbs up with the dish's count; tap to give one (Google sign-in needed). Not shown when no database is connected. */
export function LikeButton({ dish, size = "sm" }: { dish: string; size?: "sm" | "lg" }) {
  const { enabled, count, liked, toggle } = useLikes();
  if (!enabled) return null;
  const on = liked(dish);
  const n = count(dish);
  return (
    <button
      type="button"
      onClick={() => toggle(dish)}
      aria-pressed={on}
      aria-label={`${on ? "Remove your thumbs up from" : "Thumbs up"} ${dish}${n ? `, ${n} so far` : ""}`}
      className={`flex shrink-0 items-center justify-center gap-1 rounded-lg tabular-nums hover:bg-zinc-200/60 dark:hover:bg-zinc-800 ${
        on ? "text-accent" : "text-muted"
      } ${size === "lg" ? "min-h-11 min-w-11 px-2 text-lg" : "min-h-9 min-w-9 px-1.5 text-sm"}`}
    >
      <ThumbIcon filled={on} className={size === "lg" ? "size-6" : "size-5"} />
      {n > 0 && <span>{n}</span>}
    </button>
  );
}
