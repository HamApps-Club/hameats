"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { signInWithGoogle, useVotes } from "@/lib/likes";

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

/** Room a bubble needs below the buttons; with less than this left on screen it opens above them instead. */
const BUBBLE_ROOM = 190;

/**
 * The vote pill, in the style of Reddit's: a thumbs up and a thumbs down side by side, each with its own count (one of
 * each shows as 1 and 1, never netted to 0). Tap one to vote, and tap it again to take the vote back. Signed-out
 * visitors get a small bubble asking them to log in, rather than being sent straight to Google. Not shown when no
 * database is connected.
 */
export function VoteButtons({ dish, size = "sm" }: { dish: string; size?: "sm" | "lg" }) {
  const { enabled, signedIn, up, down, vote, cast } = useVotes();
  const [bubble, setBubble] = useState<"above" | "below" | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);

  // The bubble closes on Escape or a tap anywhere outside it.
  useEffect(() => {
    if (!bubble) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBubble(null);
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setBubble(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [bubble]);

  if (!enabled) return null;
  const mine = vote(dish);
  const lg = size === "lg";

  const press = (direction: 1 | -1) => {
    if (signedIn) return cast(dish, direction);
    const bottom = wrapper.current?.getBoundingClientRect().bottom ?? 0;
    setBubble(window.innerHeight - bottom < BUBBLE_ROOM ? "above" : "below");
    track("vote_login_prompt", { dish });
  };

  const button = (direction: 1 | -1) => {
    const on = mine === direction;
    const name = direction === 1 ? "Thumbs up" : "Thumbs down";
    const count = direction === 1 ? up(dish) : down(dish);
    const lit = direction === 1 ? "bg-accent/10 text-accent" : "bg-red-500/10 text-red-600 dark:text-red-400";
    return (
      <button
        type="button"
        onClick={() => press(direction)}
        aria-pressed={on}
        aria-label={`${on ? `Remove your ${name.toLowerCase()} from` : name} ${dish}, ${count} so far`}
        className={`flex items-center justify-center gap-1 ${lg ? "px-2.5 min-h-10" : "px-1.5 min-h-6"} ${
          on ? lit : "text-muted hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
        }`}
      >
        <ThumbIcon filled={on} down={direction === -1} className={lg ? "size-5" : "size-4"} />
        {/* Hidden at zero, but still takes up room, so the pills line up. */}
        <span aria-hidden className={`min-w-[1.25ch] text-center font-semibold tabular-nums ${count === 0 ? "invisible" : ""}`}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <div ref={wrapper} className="relative shrink-0">
      <div className={`flex items-stretch overflow-hidden rounded-full border border-rule ${lg ? "text-base" : "text-[11px]"}`}>
        {button(1)}
        <span aria-hidden className="my-1.5 w-px bg-rule" />
        {button(-1)}
      </div>

      {bubble && (
        <div
          role="dialog"
          aria-label="Log in to vote"
          className={`absolute ${lg ? "left-0" : "right-0"} z-40 w-64 rounded-xl border border-zinc-200 bg-white p-4 text-left text-base font-normal text-zinc-700 shadow-xl dark:border-zinc-700 dark:bg-surface dark:text-zinc-300 ${
            bubble === "below" ? "top-full mt-1.5" : "bottom-full mb-1.5"
          }`}
        >
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">Log in to vote</p>
          <p className="mt-1 text-sm">To vote on a dish or leave a review, you need to log in.</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                track("login_clicked", { from: "vote_bubble" });
                void signInWithGoogle();
              }}
              className="rounded-lg bg-accent-fill px-4 py-2 text-sm font-semibold text-on-accent"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setBubble(null)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The review pill: a speech bubble with how many reviews the dish has, so people can see there's something to read. Tapping it opens the dish. */
export function CommentPill({ dish, onClick, size = "sm" }: { dish: string; onClick: () => void; size?: "sm" | "lg" }) {
  const { enabled, reviews } = useVotes();
  if (!enabled) return null;
  const n = reviews(dish);
  const lg = size === "lg";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${n} ${n === 1 ? "review" : "reviews"} of ${dish}`}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border border-rule ${lg ? "px-2.5" : "px-1.5"} text-muted hover:bg-zinc-200/60 dark:hover:bg-zinc-800 ${
        lg ? "min-h-10 text-base" : "min-h-6 text-[11px]"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={lg ? "size-5" : "size-4"}
      >
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.8L3 20.5l1.3-4.6A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" />
      </svg>
      <span aria-hidden className="font-semibold tabular-nums">
        {n}
      </span>
    </button>
  );
}
