"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMe } from "@/lib/me";
import { signInWithGoogle } from "@/lib/login";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";

// Favorite dishes are saved to the person's account, so they need to be logged in.

/** Favorites starred on this device by an earlier version of HamEats, before they needed an account. Moved to the account on login. */
const OLD_DEVICE_KEY = "favorite-dishes";
/** A dish starred while logged out: saved once the login comes back from Google. */
const PENDING_KEY = "favorite-pending";


type Favorites = {
  /** False while signed out, or when favorites aren't available (no database). */
  ready: boolean;
  /** "loading" until the person's favorites have arrived. */
  status: "loading" | "ready" | "error";
  favorites: string[];
  isFavorite: (dish: string) => boolean;
  /** Stars or unstars a dish. Signed out, it asks them to log in first (and saves the dish once they have). */
  toggle: (dish: string, source: string) => void;
  /** Shown under the star when saving failed. */
  error: string;
};

const FavoritesContext = createContext<Favorites>({
  ready: false,
  status: "loading",
  favorites: [],
  isFavorite: () => false,
  toggle: () => {},
  error: "",
});

export const useFavorites = () => useContext(FavoritesContext);

/** Dish names compared case-insensitively, since the menu source sometimes changes a dish's capitalization. */
const sameDish = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function takeLocal(): string[] {
  const dishes: string[] = [];
  try {
    const old: unknown = JSON.parse(localStorage.getItem(OLD_DEVICE_KEY) ?? "[]");
    if (Array.isArray(old)) dishes.push(...old.filter((x): x is string => typeof x === "string"));
    const pending = sessionStorage.getItem(PENDING_KEY);
    if (pending) dishes.push(pending);
  } catch {
    // Storage blocked: nothing to move.
  }
  return dishes;
}

function clearLocal() {
  try {
    localStorage.removeItem(OLD_DEVICE_KEY);
    sessionStorage.removeItem(PENDING_KEY);
  } catch {}
}

/** The signed-in person's favorite dishes, kept in step with their account. */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const signedIn = me.status === "in";
  const [favorites, setFavorites] = useState<string[]>([]);
  const [status, setStatus] = useState<Favorites["status"]>("loading");
  const [error, setError] = useState("");
  const latest = useRef(favorites);
  useEffect(() => {
    latest.current = favorites;
  }, [favorites]);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    (async () => {
      try {
        // Anything starred on this phone before logging in goes to the account first.
        const local = takeLocal();
        const body = local.length
          ? await api<{ favorites: string[] }>("/api/favorites", "POST", { dishes: local.slice(0, 300) })
          : await api<{ favorites: string[] }>("/api/favorites", "GET");
        if (local.length) {
          clearLocal();
          track("favorites_imported", { count: local.length });
        }
        if (cancelled) return;
        setFavorites(body.favorites);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      // Logged out: forget them, so the next person to log in on this phone never sees them.
      setFavorites([]);
      setStatus("loading");
    };
  }, [signedIn]);

  const isFavorite = useCallback((dish: string) => favorites.some((f) => sameDish(f, dish)), [favorites]);

  const toggle = useCallback(
    (dish: string, source: string) => {
      if (!signedIn) {
        try {
          sessionStorage.setItem(PENDING_KEY, dish);
        } catch {}
        track("favorite_login_prompt", { dish, source });
        signInWithGoogle();
        return;
      }
      const before = latest.current;
      const match = before.find((f) => sameDish(f, dish));
      const saved = !match;
      setError("");
      setFavorites(saved ? [...before, dish] : before.filter((f) => !sameDish(f, dish)));
      track(saved ? "favorite_added" : "favorite_removed", { dish, source });
      api("/api/favorites", "POST", { dish: match ?? dish, saved }).catch((e: Error) => {
        setFavorites((now) => (saved ? now.filter((f) => !sameDish(f, dish)) : [...now, match!]));
        setError(e.message);
      });
    },
    [signedIn],
  );

  const value = useMemo<Favorites>(
    () => ({ ready: signedIn, status, favorites, isFavorite, toggle, error }),
    [signedIn, status, favorites, isFavorite, toggle, error],
  );
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}
