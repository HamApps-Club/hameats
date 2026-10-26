"use client";

import { useCallback, useEffect, useState } from "react";
import type { MenuData } from "./types";

const STORAGE_KEY = "dining_menu_v1";
/** How long a page can stay open before it is reloaded to pick up the latest menus. */
const RELOAD_AFTER_MS = 60 * 60 * 1000;

export type MenuStatus = "loading" | "cached" | "fresh" | "offline" | "error";

function readCache(): MenuData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MenuData) : null;
  } catch {
    return null;
  }
}

function writeCache(data: MenuData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked (private mode) — the app still works from the page's own menus.
  }
}

/**
 * The menus come with the page (`initial`, built on the server and at most about an hour old). The copy in
 * localStorage is only used if it's newer (an offline copy of the page can be older), and so a phone that is
 * offline still has menus. An app left open is reloaded once it's been open for an hour and the student comes
 * back to it, and `refresh` reloads it right away (used when the date rolls over).
 */
export function useMenuData(initial: MenuData | null = null) {
  const [data, setData] = useState<MenuData | null>(null);
  const [status, setStatus] = useState<MenuStatus>("loading");

  useEffect(() => {
    // After mount, so localStorage is only touched in the browser.
    Promise.resolve().then(() => {
      const cached = readCache();
      if (initial && (!cached || cached.generated_at <= initial.generated_at)) {
        writeCache(initial);
        setData(initial);
        setStatus("fresh");
      } else if (cached) {
        setData(cached);
        setStatus("offline");
      } else {
        setStatus("error");
      }
    });
  }, [initial]);

  useEffect(() => {
    const opened = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - opened >= RELOAD_AFTER_MS) location.reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const refresh = useCallback(() => location.reload(), []);

  return { data, status, generatedAt: data?.generated_at ?? null, refresh };
}
