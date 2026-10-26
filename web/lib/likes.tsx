"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { track } from "@/lib/analytics";

type Counts = { up: number; down: number };
/** 1 thumbs up, -1 thumbs down. A dish with no entry hasn't been voted on by this person. */
type Mine = Record<string, 1 | -1>;
type VoteState = { enabled: boolean; counts: Record<string, Counts>; mine: Mine };

type Votes = {
  /** False until the first answer arrives, and for good when no database is connected: no thumbs are shown then. */
  enabled: boolean;
  /** Thumbs ups minus thumbs downs from everybody: the number shown beside each dish. */
  score: (dish: string) => number;
  up: (dish: string) => number;
  down: (dish: string) => number;
  /** This person's own vote on the dish: 1, -1, or 0. */
  vote: (dish: string) => 1 | -1 | 0;
  /** Gives a thumbs up or down (tapping the same one again takes it back); sends signed-out visitors to Google sign-in. */
  cast: (dish: string, direction: 1 | -1) => void;
};

const NONE: Counts = { up: 0, down: 0 };

const VotesContext = createContext<Votes>({
  enabled: false,
  score: () => 0,
  up: () => 0,
  down: () => 0,
  vote: () => 0,
  cast: () => {},
});

export const useVotes = () => useContext(VotesContext);

export const signInWithGoogle = () => signIn("google", { callbackUrl: window.location.href });

/** Thumbs-up and thumbs-down counts for every dish, and the signed-in person's own votes, kept in step with the server. */
export function VotesProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [state, setState] = useState<VoteState>({ enabled: false, counts: {}, mine: {} });

  // Loads when the app opens, and again when someone signs in or out (their own votes change).
  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    fetch("/api/likes", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        setState(body ? { enabled: true, counts: body.counts ?? {}, mine: body.mine ?? {} } : { enabled: false, counts: {}, mine: {} });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  const cast = useCallback(
    (dish: string, direction: 1 | -1) => {
      if (!userId) {
        track("vote_login_prompt", { dish });
        void signInWithGoogle();
        return;
      }
      const before = state;
      const was = (before.mine[dish] as 1 | -1 | undefined) ?? 0;
      const vote = was === direction ? 0 : direction;
      track(vote === 1 ? "thumbs_up_given" : vote === -1 ? "thumbs_down_given" : "vote_removed", { dish });
      // Shown at once, then replaced by the server's answer (or undone if it fails).
      const c = before.counts[dish] ?? NONE;
      const counts = {
        ...before.counts,
        [dish]: {
          up: c.up - (was === 1 ? 1 : 0) + (vote === 1 ? 1 : 0),
          down: c.down - (was === -1 ? 1 : 0) + (vote === -1 ? 1 : 0),
        },
      };
      const mine = { ...before.mine };
      if (vote === 0) delete mine[dish];
      else mine[dish] = vote;
      setState({ ...before, counts, mine });
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
            return { ...s, counts: { ...s.counts, [dish]: { up: result.up, down: result.down } }, mine: next };
          }),
        )
        .catch(() =>
          setState((s) => {
            const next = { ...s.mine };
            if (was === 0) delete next[dish];
            else next[dish] = was;
            return { ...s, counts: { ...s.counts, [dish]: c }, mine: next };
          }),
        );
    },
    [userId, state],
  );

  const value = useMemo<Votes>(() => {
    const counts = (dish: string) => state.counts[dish] ?? NONE;
    return {
      enabled: state.enabled,
      score: (dish) => counts(dish).up - counts(dish).down,
      up: (dish) => counts(dish).up,
      down: (dish) => counts(dish).down,
      vote: (dish) => state.mine[dish] ?? 0,
      cast,
    };
  }, [state, cast]);
  return <VotesContext.Provider value={value}>{children}</VotesContext.Provider>;
}
