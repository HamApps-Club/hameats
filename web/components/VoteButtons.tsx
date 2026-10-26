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
 * A thumbs up, the dish's score (everybody's thumbs ups minus thumbs downs), and a thumbs down. Tap one to vote, and
 * tap it again to take the vote back. Signed-out visitors get a small bubble asking them to log in, rather than being
 * sent straight to Google. Not shown when no database is connected.
 */
export function VoteButtons({ dish, size = "sm" }: { dish: string; size?: "sm" | "lg" }) {
  const { enabled, signedIn, score, vote, cast } = useVotes();
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
  const total = score(dish);
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
    return (
      <button
        type="button"
        onClick={() => press(direction)}
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
    <div ref={wrapper} className={`relative flex shrink-0 items-center ${lg ? "text-lg" : "text-sm"}`}>
      {button(1)}
      {/* Hidden at zero, but still takes up room, so the rows line up. */}
      <span
        aria-label={`Score ${total}`}
        className={`min-w-[2ch] text-center font-semibold tabular-nums text-muted ${total === 0 ? "invisible" : ""}`}
      >
        {total}
      </span>
      {button(-1)}

      {bubble && (
        <div
          role="dialog"
          aria-label="Log in to vote"
          className={`absolute right-0 z-40 w-64 rounded-xl border border-zinc-200 bg-white p-4 text-left text-base font-normal text-zinc-700 shadow-xl dark:border-zinc-700 dark:bg-surface dark:text-zinc-300 ${
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
