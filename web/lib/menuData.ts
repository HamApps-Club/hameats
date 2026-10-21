"use client";

import { useCallback, useEffect, useState } from "react";
import type { MenuData } from "./types";

const STORAGE_KEY = "dining_menu_v1";
/** Live menus, fetched from Nutrislice on the server and cached for a day. */
const MENU_URL = "/api/menu";
/** Last scraped snapshot, used if the live route fails. */
const FALLBACK_URL = "/dining_menu.json";
/** How often an open app re-checks the menu, and the least time between two checks. */
const REFRESH_MS = 60 * 60 * 1000;
const MIN_GAP_MS = 2 * 60 * 1000;
/** Menus built into the page are used as they are for this long; after that a load fetches fresh ones. */
const EMBEDDED_MAX_AGE_MS = 90 * 60 * 1000;

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
 * Stale-while-revalidate: render the newer of the localStorage copy and the menus the server put in the
 * page (`initial`, at most an hour old) immediately. With a recent `initial` that's all a load needs; without
 * one (or an old one, e.g. from an offline copy of the page) the latest menus are fetched and swapped in.
 */
export function useMenuData(initial: MenuData | null = null) {
  const [data, setData] = useState<MenuData | null>(null);
  const [status, setStatus] = useState<MenuStatus>("loading");

  const load = useCallback(async (first = false) => {
    const cached = readCache();
    if (cached) {
      setData((prev) => prev ?? cached);
      setStatus("cached");
    }
    if (first && initial && Date.now() - Date.parse(initial.generated_at) < EMBEDDED_MAX_AGE_MS) {
      if (!cached || cached.generated_at < initial.generated_at) {
        writeCache(initial);
        setData(initial);
      }
      setStatus("fresh");
      return;
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
  }, [initial]);

  useEffect(() => {
    // Kick off after mount so localStorage is only touched in the browser.
    Promise.resolve().then(() => load(true));

    // An open app (or one left in the background) re-checks for a changed menu every hour and whenever
    // the student comes back to it, at most once every 2 minutes.
    let last = Date.now();
    const refetch = () => {
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      load();
    };
    const onVisible = () => document.visibilityState === "visible" && refetch();
    const timer = setInterval(() => document.visibilityState === "visible" && refetch(), REFRESH_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return { data, status, generatedAt: data?.generated_at ?? null, refresh: () => load() };
}
