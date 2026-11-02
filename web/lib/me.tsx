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
  /** Notifications (the morning menu alerts) you haven't opened: the gold dot on the Me tab. */
  notifications: number;
  /** Whether photo uploads are switched on (a Blob store is connected). */
  photos: boolean;
  /** The public key for push notifications, or null when they aren't set up. */
  pushKey: string | null;
  /** Whether the signed-in person has agreed to the Rules on the welcome screen. */
  rulesAccepted: boolean;
};

type Me = MeState & {
  refresh: () => void;
  setUsername: (name: string) => void;
  clearUnread: () => void;
  clearNotifications: () => void;
  acceptRules: () => Promise<void>;
};

const INITIAL: MeState = { status: "loading", username: null, joined: null, unread: false, notifications: 0, photos: false, pushKey: null, rulesAccepted: false };

const MeContext = createContext<Me>({ ...INITIAL, refresh: () => {}, setUsername: () => {}, clearUnread: () => {}, clearNotifications: () => {}, acceptRules: async () => {} });

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
            notifications: Number(b.unreadNotifications) || 0,
            photos: b.photos === true,
            pushKey: b.pushKey ?? null,
            rulesAccepted: b.rulesAccepted === true,
          });
        })
        .catch(() => !cancelled && setState((s) => (s.status === "loading" ? { ...INITIAL, status: "off" } : s)));
    load();
    // The dot can change while the app is open: check again when it comes back into view.
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    // A notification that arrives while the app is open (the service worker passes it on) shows its dot at once.
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "hameats:notification") load();
      // Tapping a notification while the app is open (see notificationclick in app/sw.js): go to the page it points to.
      if (e.data?.type === "hameats:open" && typeof e.data.url === "string") {
        const to = new URL(e.data.url, window.location.origin);
        if (to.origin === window.location.origin && to.hash !== window.location.hash) {
          history.pushState(null, "", to.pathname + to.search + to.hash);
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }
        load();
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [status, userId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const setUsername = useCallback((username: string) => setState((s) => ({ ...s, username })), []);
  const clearUnread = useCallback(() => setState((s) => ({ ...s, unread: false })), []);
  const clearNotifications = useCallback(() => setState((s) => ({ ...s, notifications: 0 })), []);
  const acceptRules = useCallback(async () => {
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptRules: true }),
    }).catch(() => null);
    if (!res?.ok) throw new Error("That didn't go through. Please try again.");
    setState((s) => ({ ...s, rulesAccepted: true }));
  }, []);
  const value = useMemo(
    () => ({ ...state, refresh, setUsername, clearUnread, clearNotifications, acceptRules }),
    [state, refresh, setUsername, clearUnread, clearNotifications, acceptRules],
  );
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}
