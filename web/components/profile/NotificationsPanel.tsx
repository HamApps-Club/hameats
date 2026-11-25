"use client";

import { useEffect, useState } from "react";
import type { Settings } from "@/lib/profile";
import { useMe } from "@/lib/me";
import { disablePush, enablePush, pushPermission, pushSupport } from "@/lib/push";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${on ? "bg-accent-fill" : "bg-zinc-300 dark:bg-zinc-700"}`}
    >
      <span aria-hidden className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** What a phone said about notifications, in words someone can act on. */
const BLOCKED =
  "Notifications are blocked for HamEats. To allow them, open your phone's Settings, find HamEats (or your browser), and turn on Notifications. Then try again.";

/**
 * The Notifications on your Profile: one switch. On, this phone gets a push notification the morning a favorite is
 * served (the morning alert, lib/alerts.ts, covers every favorite). Off stops the alerts and this phone's notifications.
 */
export function NotificationsPanel() {
  const me = useMe();
  const [s, setS] = useState<Settings | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: Settings) => !cancelled && setS(b))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const save = (next: Settings) => {
    const before = s;
    setS(next);
    api("/api/settings", "PUT", { alerts: next.alerts, email: next.email, push: next.push, muted: [] }).catch(() => {
      setS(before);
      setNote("That didn't save. Please try again.");
    });
  };

  // Turning it on asks the phone for permission. It has to happen straight from the tap, so nothing waits first.
  const toggle = async (on: boolean) => {
    if (!s) return;
    setNote("");
    track("alerts_toggled", { on });
    if (!on) {
      setBusy(true);
      await disablePush();
      setBusy(false);
      return save({ ...s, alerts: false, push: false });
    }
    const support = pushSupport();
    if (support === "needs-home-screen")
      return setNote("On iPhone, notifications only work from the Home Screen. In Safari, tap Share, then Add to Home Screen. Open HamEats from there and turn this on.");
    if (support === "unsupported") return setNote("This browser can't show notifications.");
    if (!me.pushKey) return setNote("Notifications aren't switched on for HamEats yet.");
    if (pushPermission() === "denied") return setNote(BLOCKED);
    setBusy(true);
    const result = await enablePush(me.pushKey);
    setBusy(false);
    track("push_permission", { result });
    if (result === "on") return save({ ...s, alerts: true, push: true });
    setNote(
      result === "denied" ? BLOCKED : result === "dismissed" ? "Notifications weren't allowed, so they stay off." : "Couldn't turn on notifications. Please try again.",
    );
  };

  if (!s) return <p className="py-6 text-center text-muted">{failed ? "Couldn't load your settings. Check your connection and try again." : "Loading…"}</p>;

  return (
    <section>
      <div className="flex items-start gap-4 rounded-[10px] border border-rule bg-surface px-4 py-3 shadow-[0_8px_20px_-14px] shadow-black/20">
        <div className="min-w-0 flex-1">
          <p className="text-[16.5px] font-semibold leading-snug">Push notifications</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">
            A notification on this phone the morning one of your favorites is served. On iPhone this only works once HamEats is on your Home Screen.
          </p>
        </div>
        <Switch on={s.alerts && s.push} onChange={(on) => void toggle(on)} label="Push notifications" disabled={busy} />
      </div>
      {note && (
        <p role="status" className="mt-2 px-1 text-[13px] text-zinc-700 dark:text-zinc-300">
          {note}
        </p>
      )}
    </section>
  );
}
