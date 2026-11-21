"use client";

import { useCallback, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";

// Favorite dishes, saved on this device only (no account needed). Stored as the dish names in the order they were
// starred. Names are compared case-insensitively, since the menu source sometimes changes a dish's capitalization.

const STORAGE_KEY = "favorite-dishes";
// localStorage's "storage" event only fires in other tabs, so same-tab listeners get this one.
const LOCAL_CHANGE_EVENT = "favorite-dishes-change";

const EMPTY: string[] = [];
let cachedRaw: string | null = null;
let cached: string[] = EMPTY;

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  // useSyncExternalStore needs the same array back while nothing changed.
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cached = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function write(names: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
  } catch {
    // Private mode or storage full: the star just won't stick.
  }
  window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_CHANGE_EVENT, onChange);
  };
}

export const sameDish = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The starred dishes, and a way to star or unstar one. */
export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, read, () => EMPTY);
  const isFavorite = useCallback((dish: string) => favorites.some((f) => sameDish(f, dish)), [favorites]);
  const toggle = useCallback((dish: string, source: string) => {
    const current = read();
    const on = current.some((f) => sameDish(f, dish));
    write(on ? current.filter((f) => !sameDish(f, dish)) : [...current, dish]);
    track(on ? "favorite_removed" : "favorite_added", { dish, source });
  }, []);
  return { favorites, isFavorite, toggle };
}
