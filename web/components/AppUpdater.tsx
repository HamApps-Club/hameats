"use client";

import { useCallback, useEffect, useState } from "react";

/** The deploy this page was built from (set in next.config.ts). */
const BUILD_ID = process.env.BUILD_ID;
const CHECK_EVERY_MS = 10 * 60 * 1000;
const RELOADED_KEY = "ham-eats-reloaded-for";

async function latestVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    return res.ok ? ((await res.json()) as { version?: string }).version ?? null : null;
  } catch {
    return null; // Offline: nothing to do.
  }
}

/** Reload once for a given version; if that didn't bring it in (a stale edge cache), don't loop. */
function reloadFor(version: string) {
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === version) return false;
    sessionStorage.setItem(RELOADED_KEY, version);
  } catch {
    // Storage blocked: still reload once; the next check will just offer the button.
  }
  window.location.reload();
  return true;
}

/**
 * Keeps the installed app on the latest Vercel deploy:
 * - registers the service worker and asks for a new one whenever the app is opened or brought back;
 * - checks /api/version at those moments and every 10 minutes. Opening or returning to the app reloads
 *   straight into the new version; while it's in use, an "Update" bar appears instead.
 */
export function AppUpdater() {
  const [updateReady, setUpdateReady] = useState(false);

  const check = useCallback(async (reloadIfNew: boolean) => {
    const version = await latestVersion();
    if (!version || version === BUILD_ID) return;
    if (!(reloadIfNew && reloadFor(version))) setUpdateReady(true);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    let registration: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((r) => (registration = r))
        .catch(() => {
          // Not fatal: the site still works, just without offline support.
        });
    }

    // First check on launch, after mount (same pattern as the menu loader).
    void Promise.resolve().then(() => check(true));
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      registration?.update().catch(() => {});
      void check(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void check(false);
    }, CHECK_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [check]);

  if (!updateReady) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-white dark:text-zinc-900">
        <span>A new version of Ham Eats is ready.</span>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-white px-3 py-1.5 font-semibold text-zinc-900 dark:bg-zinc-900 dark:text-white"
        >
          Update
        </button>
      </div>
    </div>
  );
}
