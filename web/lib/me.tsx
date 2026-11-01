"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type MeState = {
  /** "loading" until the first answer; "off" when no database is connected (the Feed and profiles are hidden then). */
  status: "loading" | "off" | "out" | "in";
  username: string | null;
  joined: string | null;
  /** Someone commented on or upvoted your post since you last opened the Feed: the gold dot on the Feed tab. */
  unread: boolean;
  /** Whether photo uploads are switched on (a Blob store is connected). */
  photos: boolean;
  /** The public key for push notifications, or null when they aren't set up. */
  pushKey: string | null;
};

type Me = MeState & {
  refresh: () => void;
  setUsername: (name: string) => void;
  clearUnread: () => void;
};

const INITIAL: MeState = { status: "loading", username: null, joined: null, unread: false, photos: false, pushKey: null };

const MeContext = createContext<Me>({ ...INITIAL, refresh: () => {}, setUsername: () => {}, clearUnread: () => {} });

export const useMe = () => useContext(MeContext);

/** The signed-in person's username and the app's features, from /api/me, kept in step with logging in and out. */
export function MeProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [state, setState] = useState<MeState>(INITIAL);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    const load = () =>
      fetch("/api/me", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((b) => {
          if (cancelled) return;
          if (!b) return setState((s) => (s.status === "loading" ? { ...INITIAL, status: "off" } : s));
          setState({
            status: b.signedIn ? "in" : "out",
            username: b.username ?? null,
            joined: b.joined ?? null,
            unread: b.unread === true,
            photos: b.photos === true,
            pushKey: b.pushKey ?? null,
          });
        })
        .catch(() => !cancelled && setState((s) => (s.status === "loading" ? { ...INITIAL, status: "off" } : s)));
    load();
    // The dot can change while the app is open: check again when it comes back into view.
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, userId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const setUsername = useCallback((username: string) => setState((s) => ({ ...s, username })), []);
  const clearUnread = useCallback(() => setState((s) => ({ ...s, unread: false })), []);
  const value = useMemo(() => ({ ...state, refresh, setUsername, clearUnread }), [state, refresh, setUsername, clearUnread]);
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}
