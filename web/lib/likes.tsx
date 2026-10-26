"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { track } from "@/lib/analytics";

type LikeState = { enabled: boolean; loaded: boolean; counts: Record<string, number>; mine: string[] };

type Likes = {
  /** False until the first answer arrives, and for good when no database is connected: no thumbs are shown then. */
  enabled: boolean;
  count: (dish: string) => number;
  liked: (dish: string) => boolean;
  /** Gives or takes back a thumbs up; sends signed-out visitors to Google sign-in instead. */
  toggle: (dish: string) => void;
};

const LikesContext = createContext<Likes>({ enabled: false, count: () => 0, liked: () => false, toggle: () => {} });

export const useLikes = () => useContext(LikesContext);

export const signInWithGoogle = () => signIn("google", { callbackUrl: window.location.href });

/** Thumbs-up counts for every dish, and the signed-in person's own, kept in step with the server. */
export function LikesProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [state, setState] = useState<LikeState>({ enabled: false, loaded: false, counts: {}, mine: [] });

  // Loads when the app opens, and again when someone signs in or out (their own thumbs change).
  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    fetch("/api/likes", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        setState(
          body
            ? { enabled: true, loaded: true, counts: body.counts ?? {}, mine: body.mine ?? [] }
            : { enabled: false, loaded: true, counts: {}, mine: [] },
        );
      })
      .catch(() => !cancelled && setState((s) => ({ ...s, loaded: true })));
    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  const toggle = useCallback(
    (dish: string) => {
      if (!userId) {
        track("thumbs_up_login_prompt", { dish });
        void signInWithGoogle();
        return;
      }
      const before = state;
      const liked = !before.mine.includes(dish);
      track(liked ? "thumbs_up_given" : "thumbs_up_removed", { dish });
      // Shown at once, then replaced by the server's answer (or undone if it fails).
      setState({
        ...before,
        counts: { ...before.counts, [dish]: Math.max(0, (before.counts[dish] ?? 0) + (liked ? 1 : -1)) },
        mine: liked ? [...before.mine, dish] : before.mine.filter((d) => d !== dish),
      });
      fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish, liked }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((result: { count: number; liked: boolean }) =>
          setState((s) => ({
            ...s,
            counts: { ...s.counts, [dish]: result.count },
            mine: result.liked ? [...new Set([...s.mine, dish])] : s.mine.filter((d) => d !== dish),
          })),
        )
        .catch(() =>
          setState((s) => ({
            ...s,
            counts: { ...s.counts, [dish]: before.counts[dish] ?? 0 },
            mine: before.mine.includes(dish) ? [...new Set([...s.mine, dish])] : s.mine.filter((d) => d !== dish),
          })),
        );
    },
    [userId, state],
  );

  const value = useMemo<Likes>(
    () => ({
      enabled: state.enabled,
      count: (dish) => state.counts[dish] ?? 0,
      liked: (dish) => state.mine.includes(dish),
      toggle,
    }),
    [state, toggle],
  );
  return <LikesContext.Provider value={value}>{children}</LikesContext.Provider>;
}
