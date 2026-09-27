"use client";

import { useEffect } from "react";

/** Registers /sw.js in production so the app installs and works offline. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not fatal: the site still works, just without offline support.
    });
  }, []);
  return null;
}
