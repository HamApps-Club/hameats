"use client";

import { useCallback, useEffect, useState } from "react";
import type { MenuData } from "./types";

const STORAGE_KEY = "dining_menu_v1";
const MENU_URL = "/dining_menu.json";

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
 * then fetch the latest dining_menu.json and swap it in if it changed.
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
      const res = await fetch(MENU_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fresh = (await res.json()) as MenuData;
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
