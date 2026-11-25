"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type MeState = {
  /** "loading" until the first answer; "off" when no database is connected (favorites and alerts are unavailable then). */
  status: "loading" | "off" | "out" | "in";
  /** Notifications (the morning menu alerts) you haven't opened: the gold dot on the Profile tab. */
  notifications: number;
  /** The public key for push notifications, or null when they aren't set up. */
  pushKey: string | null;
};

type Me = MeState & {
  refresh: () => void;
  clearNotifications: () => void;
};

const INITIAL: MeState = { status: "loading", notifications: 0, pushKey: null };

const MeContext = createContext<Me>({ ...INITIAL, refresh: () => {}, clearNotifications: () => {} });

export const useMe = () => useContext(MeContext);

/** Whether someone is signed in, their unread notifications and the push key, from /api/me, kept in step with logging in and out. */
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
            notifications: Number(b.unreadNotifications) || 0,
            pushKey: b.pushKey ?? null,
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
  const clearNotifications = useCallback(() => setState((s) => ({ ...s, notifications: 0 })), []);
  const value = useMemo(
    () => ({ ...state, refresh, clearNotifications }),
    [state, refresh, clearNotifications],
  );
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}
