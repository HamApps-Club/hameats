"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { track } from "@/lib/analytics";

type Counts = { up: number; down: number; reviews: number };
/** 1 thumbs up, -1 thumbs down. A dish with no entry hasn't been voted on by this person. */
type Mine = Record<string, 1 | -1>;
type VoteState = { enabled: boolean; counts: Record<string, Counts>; mine: Mine };

type Votes = {
  /** False until the first answer arrives, and for good when no database is connected: no thumbs are shown then. */
  enabled: boolean;
  signedIn: boolean;
  /** How many people gave the dish a thumbs up, and a thumbs down. Shown separately, never netted against each other. */
  up: (dish: string) => number;
  down: (dish: string) => number;
  /** How many reviews have been written about the dish. */
  reviews: (dish: string) => number;
  /** Keeps the review count in step after the reviews are loaded, or one is added or deleted. */
  setReviews: (dish: string, count: number) => void;
  /** This person's own vote on the dish: 1, -1, or 0. */
  vote: (dish: string) => 1 | -1 | 0;
  /** Gives a thumbs up or down (tapping the same one again takes it back). Does nothing when signed out. */
  cast: (dish: string, direction: 1 | -1) => void;
};

const NONE: Counts = { up: 0, down: 0, reviews: 0 };

const VotesContext = createContext<Votes>({
  enabled: false,
  signedIn: false,
  up: () => 0,
  down: () => 0,
  reviews: () => 0,
  setReviews: () => {},
  vote: () => 0,
  cast: () => {},
});

export const useVotes = () => useContext(VotesContext);

/** While the app is on screen, the counts are fetched again this often (and at once whenever it comes back into view). */
export const REFRESH_MS = 30_000;

export const signInWithGoogle = () => signIn("google", { callbackUrl: window.location.href });

/** Thumbs-up and thumbs-down counts for every dish, and the signed-in person's own votes, kept in step with the server. */
export function VotesProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [state, setState] = useState<VoteState>({ enabled: false, counts: {}, mine: {} });

  // Votes sent to the server that haven't been answered yet; a refresh waits for them so it can't undo one.
  const pending = useRef(0);

  // Loads when the app opens and when someone signs in or out (their own votes change). Then it keeps the numbers
  // fresh: a home-screen app is only paused in the background, not reloaded, so it fetches again the moment it
  // comes back into view, and every REFRESH_MS while it's showing.
  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    let lastLoad = 0;
    const load = (first: boolean) => {
      if (!first && pending.current > 0) return;
      lastLoad = Date.now();
      fetch("/api/likes", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (cancelled || pending.current > 0) return;
          if (body) setState({ enabled: true, counts: body.counts ?? {}, mine: body.mine ?? {} });
          // A failed refresh (offline, a hiccup) keeps what's on screen; only the first load can turn the thumbs off.
          else if (first) setState({ enabled: false, counts: {}, mine: {} });
        })
        .catch(() => {});
    };
    load(true);
    const onBackInView = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoad > 3000) load(false);
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load(false);
    }, REFRESH_MS);
    document.addEventListener("visibilitychange", onBackInView);
    window.addEventListener("pageshow", onBackInView);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onBackInView);
      window.removeEventListener("pageshow", onBackInView);
    };
  }, [status, userId]);

  const cast = useCallback(
    (dish: string, direction: 1 | -1) => {
      if (!userId) return;
      const before = state;
      const was = (before.mine[dish] as 1 | -1 | undefined) ?? 0;
      const vote = was === direction ? 0 : direction;
      track(vote === 1 ? "thumbs_up_given" : vote === -1 ? "thumbs_down_given" : "vote_removed", { dish });
      // Shown at once, then replaced by the server's answer (or undone if it fails).
      const c = before.counts[dish] ?? NONE;
      const counts = {
        ...before.counts,
        [dish]: {
          ...c,
          up: c.up - (was === 1 ? 1 : 0) + (vote === 1 ? 1 : 0),
          down: c.down - (was === -1 ? 1 : 0) + (vote === -1 ? 1 : 0),
        },
      };
      const mine = { ...before.mine };
      if (vote === 0) delete mine[dish];
      else mine[dish] = vote;
      setState({ ...before, counts, mine });
      pending.current++;
      fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish, vote }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((result: { up: number; down: number; vote: number }) =>
          setState((s) => {
            const next = { ...s.mine };
            if (result.vote === 0) delete next[dish];
            else next[dish] = result.vote as 1 | -1;
            return { ...s, counts: { ...s.counts, [dish]: { ...(s.counts[dish] ?? NONE), up: result.up, down: result.down } }, mine: next };
          }),
        )
        .catch(() =>
          setState((s) => {
            const next = { ...s.mine };
            if (was === 0) delete next[dish];
            else next[dish] = was;
            return { ...s, counts: { ...s.counts, [dish]: { ...(s.counts[dish] ?? NONE), up: c.up, down: c.down } }, mine: next };
          }),
        )
        .finally(() => {
          pending.current--;
        });
    },
    [userId, state],
  );

  const setReviews = useCallback(
    (dish: string, count: number) =>
      setState((s) => {
        const c = s.counts[dish] ?? NONE;
        return c.reviews === count ? s : { ...s, counts: { ...s.counts, [dish]: { ...c, reviews: count } } };
      }),
    [],
  );

  const value = useMemo<Votes>(() => {
    const counts = (dish: string) => state.counts[dish] ?? NONE;
    return {
      enabled: state.enabled,
      signedIn: !!userId,
      up: (dish) => counts(dish).up,
      down: (dish) => counts(dish).down,
      reviews: (dish) => counts(dish).reviews,
      setReviews,
      vote: (dish) => state.mine[dish] ?? 0,
      cast,
    };
  }, [state, cast, userId, setReviews]);
  return <VotesContext.Provider value={value}>{children}</VotesContext.Provider>;
}
