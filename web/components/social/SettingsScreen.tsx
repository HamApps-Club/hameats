"use client";

import { useEffect, useState } from "react";
import type { Settings } from "@/lib/social";
import { HALL_SHORT } from "@/lib/halls";
import { useMe } from "@/lib/me";
import { disablePush, enablePush, pushPermission, pushSupport } from "@/lib/push";
import { track } from "@/lib/analytics";
import { Screen, api } from "@/components/social/bits";

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

function Row({ title, text, on, onChange, disabled }: { title: string; text: string; on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[16.5px] font-semibold leading-snug">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted">{text}</p>
      </div>
      <Switch on={on} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

const Label = ({ children }: { children: string }) => (
  <h3 className="mb-2 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.16em] text-accent after:h-px after:flex-1 after:bg-rule">{children}</h3>
);

/** What a phone said about notifications, in words someone can act on. */
const BLOCKED =
  "Notifications are blocked for HamEats. To allow them, open your phone's Settings, find HamEats (or your browser), and turn on Notifications. Then try again.";

/** Settings: alerts for the dishes you like, how they reach you, and which dishes. */
export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const [s, setS] = useState<Settings | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setS)
      .catch(() => setFailed(true));
  }, []);

  const save = (next: Settings) => {
    const before = s;
    setS(next);
    api("/api/settings", "PUT", { alerts: next.alerts, email: next.email, push: next.push, muted: next.muted }).catch(() => {
      setS(before);
      setNote("That didn't save. Please try again.");
    });
  };

  // Turning push on asks the phone for permission. It has to happen straight from the tap, so nothing waits first.
  const setPush = async (on: boolean) => {
    if (!s) return;
    setNote("");
    if (!on) {
      setBusy(true);
      await disablePush();
      setBusy(false);
      return save({ ...s, push: false });
    }
    const support = pushSupport();
    if (support === "needs-home-screen")
      return setNote("On iPhone, notifications only work from the Home Screen. In Safari, tap Share, then Add to Home Screen. Open HamEats from there and turn this on.");
    if (support === "unsupported") return setNote("This browser can't show notifications. Email alerts work everywhere.");
    if (!me.pushKey) return setNote("Push notifications aren't switched on for HamEats yet. Email alerts are ready now.");
    if (pushPermission() === "denied") return setNote(BLOCKED);
    setBusy(true);
    const result = await enablePush(me.pushKey);
    setBusy(false);
    track("push_permission", { result });
    if (result === "on") return save({ ...s, push: true });
    setNote(
      result === "denied" ? BLOCKED : result === "dismissed" ? "Notifications weren't allowed, so push stays off." : "Couldn't turn on notifications. Please try again.",
    );
  };

  const dishes = s?.dishes.filter((d) => !d.dinerOnly) ?? [];
  const hidDiner = !!s && dishes.length < s.dishes.length;
  const off = !s?.alerts;
  const card = "rounded-[10px] border border-rule bg-surface px-4 shadow-[0_8px_20px_-14px] shadow-black/20";

  return (
    <Screen label="Settings" onClose={onClose} title={<h2 className="font-display text-xl font-bold">Settings</h2>}>
      {!s ? (
        <p className="py-16 text-center text-muted">{failed ? "Couldn't load your settings. Check your connection and try again." : "Loading…"}</p>
      ) : (
        <div className="space-y-6 px-3.5 pb-10 pt-4">
          <section className={card}>
            <Row
              title="Tell me when a dish I like is served"
              text="One message the morning it's on the menu, with the dining hall and the meal."
              on={s.alerts}
              onChange={(alerts) => {
                track("alerts_toggled", { on: alerts });
                save({ ...s, alerts });
              }}
            />
          </section>
          <p className="-mt-3 px-1 text-[13px] text-muted">Push alerts arrive each morning. Email alerts are coming soon.</p>

          <section className={off ? "opacity-50" : ""}>
            <Label>How should we tell you?</Label>
            <div className={`${card} divide-y divide-rule`}>
              <Row title="Email" text="Sent to your Hamilton email address. Coming soon." on={s.email} onChange={(email) => save({ ...s, email })} disabled={off} />
              <Row
                title="Push notification"
                text="A notification on this phone. On iPhone it only works once HamEats is on your Home Screen, and your phone asks you first."
                on={s.push}
                onChange={(on) => void setPush(on)}
                disabled={off || busy}
              />
            </div>
            {note && (
              <p role="status" className="mt-2 px-1 text-[13px] text-zinc-700 dark:text-zinc-300">
                {note}
              </p>
            )}
          </section>

          <section className={off ? "opacity-50" : ""}>
            <Label>Which dishes?</Label>
            {dishes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-rule p-6 text-center text-[15px] text-muted">Give a dish a thumbs up on the Menu and it shows up here.</p>
            ) : (
              <>
                <p className="mb-2 text-[13px] text-muted">Choose from the dishes you&apos;ve liked. Switch one off to stop hearing about it.</p>
                <ul className={`${card} divide-y divide-rule`}>
                  {dishes.map((d) => (
                    <li key={d.name}>
                      <Row
                        title={d.name}
                        text={d.halls.map((h) => HALL_SHORT[h] ?? h).join(", ") || "Not on a menu yet"}
                        on={!s.muted.includes(d.name)}
                        onChange={(on) => save({ ...s, muted: on ? s.muted.filter((x) => x !== d.name) : [...s.muted, d.name] })}
                        disabled={off}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
            {hidDiner && <p className="mt-2 px-1 text-[13px] text-muted">Howard Diner dishes aren&apos;t listed, because the Diner serves them every day.</p>}
          </section>
        </div>
      )}
    </Screen>
  );
}
