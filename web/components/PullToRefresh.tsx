"use client";

import { useEffect, useState } from "react";

/** How far (px) the arrow has to be pulled before letting go refreshes, and how far it can be pulled at most. */
const TRIGGER = 56;
const MAX = 80;

const isHomeScreenApp = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Pull down from the top of the page to refresh, like in other apps. Only in the home-screen app: iOS gives those
 * no pull-to-refresh of their own (the browser has one). It reloads the page, which also brings in a new version of
 * the app and fresh menus, votes and reviews.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isHomeScreenApp()) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let distance = 0;

    const reset = () => {
      tracking = false;
      distance = 0;
      setPull(0);
    };
    const onStart = (e: TouchEvent) => {
      // Only from the very top of the page, with one finger, and not while a food's page is open over it.
      if (e.touches.length !== 1 || window.scrollY > 0 || document.body.style.overflow === "hidden") return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      // Not a pull: upward, sideways (the day picker scrolls sideways), or the page has scrolled.
      if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) return reset();
      distance = Math.min(MAX, dy * 0.5);
      setPull(distance);
    };
    const onEnd = () => {
      if (!tracking) return;
      const done = distance >= TRIGGER;
      tracking = false;
      if (!done) return reset();
      setRefreshing(true);
      setPull(TRIGGER);
      // A moment to see the spinner.
      setTimeout(() => window.location.reload(), 350);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", reset);
    };
  }, []);

  if (pull <= 0 && !refreshing) return null;
  const ready = pull >= TRIGGER;
  return (
    <div
      role="status"
      aria-label={refreshing ? "Refreshing" : "Pull to refresh"}
      className="pointer-events-none fixed left-1/2 z-[70] -translate-x-1/2"
      style={{ top: `calc(env(safe-area-inset-top) + ${pull}px - 20px)` }}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-white text-zinc-700 shadow-lg ring-1 ring-black/10 dark:bg-surface dark:text-zinc-200 dark:ring-white/15">
        {refreshing ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden className="size-5 animate-spin">
            <path d="M12 3a9 9 0 1 0 9 9" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="size-5 transition-transform"
            style={{ transform: `rotate(${ready ? 180 : 0}deg)` }}
          >
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
        )}
      </div>
    </div>
  );
}
