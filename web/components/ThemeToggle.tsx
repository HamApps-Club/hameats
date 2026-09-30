"use client";

import { useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";

// The `dark` class on <html> is set before first paint by the script in app/layout.tsx
// (saved choice, else the system setting); this button flips it and saves the choice.
const subscribe = (cb: () => void) => {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};
const isDark = () => document.documentElement.classList.contains("dark");

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  const toggle = () => {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    track("night_mode_toggled", { mode: next ? "dark" : "light" });
  };

  return (
    <div className="fixed left-3 top-3 z-20">
      <button
        onClick={toggle}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        className="flex size-10 items-center justify-center rounded-lg bg-white/90 text-zinc-800 shadow-sm ring-1 ring-zinc-200 backdrop-blur hover:bg-white dark:bg-zinc-800/90 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-700"
      >
        {dark ? (
          // Sun: tap for light
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden className="size-5">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          // Moon: tap for dark
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-5">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
