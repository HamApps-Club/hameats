"use client";

import { useCallback, useEffect, useState } from "react";
import type { MenuData } from "./types";

const STORAGE_KEY = "dining_menu_v1";
/** Live menus, fetched from Nutrislice on the server and cached for a day. */
const MENU_URL = "/api/menu";
/** Last scraped snapshot, used if the live route fails. */
const FALLBACK_URL = "/dining_menu.json";

async function fetchMenu(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as MenuData;
}

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
    // Storage full or blocked (private mode) — the app still works from the network.
  }
}

/**
 * Stale-while-revalidate: render the localStorage copy immediately,
 * then fetch the latest menus and swap them in if they changed.
 */
export function useMenuData() {
  const [data, setData] = useState<MenuData | null>(null);
  const [status, setStatus] = useState<MenuStatus>("loading");

  const load = useCallback(async () => {
    const cached = readCache();
    if (cached) {
      setData((prev) => prev ?? cached);
      setStatus("cached");
    }
    try {
      const fresh = await fetchMenu(MENU_URL).catch(() => fetchMenu(FALLBACK_URL));
      // The fallback snapshot can be older than what this browser already has; keep the newer one.
      if (cached && cached.generated_at > fresh.generated_at) {
        setStatus("offline");
        return;
      }
      if (!cached || cached.generated_at !== fresh.generated_at) writeCache(fresh);
      setData(fresh);
      setStatus("fresh");
    } catch {
      setStatus(cached ? "offline" : "error");
    }
  }, []);

  useEffect(() => {
    // Kick off after mount so localStorage is only touched in the browser.
    Promise.resolve().then(load);
  }, [load]);

  return { data, status, generatedAt: data?.generated_at ?? null, refresh: load };
}
