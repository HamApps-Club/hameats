"use client";

import { useEffect, useState } from "react";
import type { NotificationItem, Settings } from "@/lib/profile";
import { HALL_SHORT } from "@/lib/halls";
import { useMe } from "@/lib/me";
import { useFavorites } from "@/lib/favorites";
import { disablePush, enablePush, pushPermission, pushSupport } from "@/lib/push";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";

export const card = "rounded-[10px] border border-rule bg-surface px-4 shadow-[0_8px_20px_-14px] shadow-black/20";

export const Label = ({ children }: { children: string }) => (
  <h3 className="mb-2 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.16em] text-accent after:h-px after:flex-1 after:bg-rule">{children}</h3>
);

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

/** What a phone said about notifications, in words someone can act on. */
const BLOCKED =
  "Notifications are blocked for HamEats. To allow them, open your phone's Settings, find HamEats (or your browser), and turn on Notifications. Then try again.";

/** The Notifications on your Profile: the alert switches up top, then the alerts you've been sent. */
export function NotificationsPanel() {
  return (
    <div className="space-y-7">
      <AlertSettings />
      <section>
        <Label>Recent</Label>
        <Inbox />
      </section>
    </div>
  );
}

/** Alerts for your favorites: on or off, how they reach you, and which favorites. */
function AlertSettings() {
  const me = useMe();
  // Reloads when favorites change, so a dish starred elsewhere shows up in the list.
  const { favorites } = useFavorites();
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
  }, [favorites]);

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
    if (support === "unsupported") return setNote("This browser can't show notifications. Your alerts are still saved below.");
    if (!me.pushKey) return setNote("Push notifications aren't switched on for HamEats yet. Your alerts are still saved below.");
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

  if (!s) return <p className="py-6 text-center text-muted">{failed ? "Couldn't load your alert settings. Check your connection and try again." : "Loading…"}</p>;

  const dishes = s.dishes.filter((d) => !d.dinerOnly);
  const hidDiner = dishes.length < s.dishes.length;
  const off = !s.alerts;

  return (
    <div className="space-y-6">
      <section>
        <div className={card}>
          <Row
            title="Tell me when a favorite is served"
            text="One alert the morning it's on the menu, with the dining hall and the meal."
            on={s.alerts}
            onChange={(alerts) => {
              track("alerts_toggled", { on: alerts });
              save({ ...s, alerts });
            }}
          />
          <div className={`border-t border-rule ${off ? "opacity-50" : ""}`}>
            <Row
              title="Push notification"
              text="Also send it to this phone. On iPhone this only works once HamEats is on your Home Screen, and your phone asks you first."
              on={s.push}
              onChange={(on) => void setPush(on)}
              disabled={off || busy}
            />
          </div>
        </div>
        <p className="mt-2 px-1 text-[13px] text-muted">Alerts arrive at 8 AM and are saved under Recent, below.</p>
        {note && (
          <p role="status" className="mt-2 px-1 text-[13px] text-zinc-700 dark:text-zinc-300">
            {note}
          </p>
        )}
      </section>

      <section className={off ? "opacity-50" : ""}>
        <Label>Alert me about</Label>
        {dishes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-rule p-6 text-center text-[15px] text-muted">
            Your favorites show up here. Star a dish on the Menu to add one.
          </p>
        ) : (
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
        )}
        {hidDiner && <p className="mt-2 px-1 text-[13px] text-muted">Howard Diner dishes aren&apos;t listed, because the Diner serves them every day.</p>}
      </section>
    </div>
  );
}

const HALL_NAME: Record<string, string> = { commons: "Soper Commons", mcewen: "McEwen", diner: "Howard Diner", "little-pub": "Little Pub" };
const MEALS = ["Breakfast", "Lunch", "Dinner"];
const SENT_AT = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Opens a dining hall's menu (its page lives at #slug). */
function openHall(slug: string) {
  history.pushState(null, "", `#${slug}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  window.scrollTo({ top: 0 });
}

/** One row per dish and hall, with every meal it's served at there, in meal order. */
function groupItems(items: NotificationItem["items"]) {
  const rows = new Map<string, { dish: string; hall: string; meals: string[] }>();
  for (const it of items) {
    const key = `${it.dish}|${it.hall}`;
    const row = rows.get(key) ?? { dish: it.dish, hall: it.hall, meals: [] };
    if (!row.meals.includes(it.meal)) row.meals.push(it.meal);
    rows.set(key, row);
  }
  const rank = (m: string) => (MEALS.indexOf(m) + 4) % 4;
  return [...rows.values()].map((r) => ({ ...r, meals: r.meals.sort((a, b) => rank(a) - rank(b)) }));
}

/**
 * The alerts you've been sent, each listing the favorites on that day's menu with their hall and meal (tap one for that
 * hall's menu). Opening it marks them all read, which clears the dot on the Profile tab; the ones that were new keep a
 * gold dot until you leave.
 */
function Inbox() {
  const { clearNotifications } = useMe();
  const [list, setList] = useState<NotificationItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/notifications", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((b: { notifications: NotificationItem[] }) => {
          if (cancelled) return;
          setList(b.notifications);
          const unread = b.notifications.filter((n) => !n.read).map((n) => n.id);
          if (unread.length) {
            setFresh((f) => new Set([...f, ...unread]));
            clearNotifications();
            void fetch("/api/notifications", { method: "POST" }).catch(() => {});
          }
        })
        .catch(() => !cancelled && setFailed(true));
    load();
    // New ones can arrive while this is open: check again when the app comes back into view, or a notification arrives.
    const onVisible = () => document.visibilityState === "visible" && load();
    const onMessage = (e: MessageEvent) => e.data?.type === "hameats:notification" && load();
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [clearNotifications]);

  if (!list) return <p className="py-6 text-center text-muted">{failed ? "Couldn't load your notifications. Check your connection and try again." : "Loading…"}</p>;
  if (!list.length)
    return (
      <p className="rounded-xl border border-dashed border-rule p-6 text-center text-[15px] text-muted">
        No alerts yet. Turn them on above, and at 8 AM on days a favorite is served we&apos;ll tell you where and for which meal.
      </p>
    );
  return (
    <ul className="space-y-3">
      {list.map((n) => (
        <li key={n.id} className={`${card} py-3.5`}>
          <p className="flex items-center gap-2 text-sm text-muted">
            <span>{SENT_AT.format(new Date(n.createdAt))}</span>
            {fresh.has(n.id) && <span aria-label="New" className="ml-auto size-[9px] shrink-0 rounded-full bg-gold" />}
          </p>
          <p className="mt-0.5 text-[17px] font-bold leading-snug">{n.title}</p>
          {n.items.length ? (
            <ul className="-mx-1 mt-1.5 divide-y divide-rule">
              {groupItems(n.items).map((g) => (
                <li key={`${g.dish}|${g.hall}`}>
                  <button type="button" onClick={() => openHall(g.hall)} className="flex w-full items-center gap-3 rounded-md px-1 py-2 text-left hover:bg-accent/5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-semibold leading-snug">{g.dish}</span>
                      <span className="block text-[13.5px] text-muted">
                        {HALL_NAME[g.hall] ?? g.hall} · {g.meals.join(", ")}
                      </span>
                    </span>
                    <span aria-hidden className="text-muted">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-[15px] leading-snug">{n.body}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
