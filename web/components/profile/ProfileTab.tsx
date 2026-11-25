"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import type { CampusTime } from "@/lib/hours";
import type { MenuData } from "@/lib/types";
import { useMe } from "@/lib/me";
import { useFavorites } from "@/lib/favorites";
import { signInWithGoogle } from "@/lib/login";
import { disablePush } from "@/lib/push";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { StarIcon } from "@/components/FavoriteButton";
import { goToSection } from "@/components/SectionTabs";
import { FavoritesPanel } from "@/components/profile/FavoritesPanel";
import { Label, NotificationsPanel, card } from "@/components/profile/NotificationsPanel";

const Bell = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

type Panel = "favorites" | "notifications";

/**
 * The Profile tab: who's logged in, then two panels, Favorites (the dishes they saved, and when each is served next)
 * and Notifications (the morning alerts: on or off, push, which favorites, and the ones already sent), then account
 * links. `notifications` opens on Notifications (the #notifications address, where tapping an alert goes).
 */
export function ProfileTab({ data, now, notifications = false }: { data: MenuData; now: CampusTime; notifications?: boolean }) {
  const me = useMe();
  const { favorites, status } = useFavorites();
  // The panel follows the address (#profile or #notifications), so Back, a reload and a tapped alert all land right.
  const panel: Panel = notifications ? "notifications" : "favorites";

  if (me.status === "loading") return <p className="py-16 text-center text-muted">Loading…</p>;
  if (me.status === "off")
    return <p className="px-4 py-16 text-center text-muted">Favorites and alerts aren&apos;t available right now. Please try again later.</p>;
  if (me.status === "out") return <SignedOut />;

  const choose = (p: Panel) => {
    if (p === panel) return;
    track("profile_panel_opened", { panel: p });
    goToSection(p === "notifications" ? "notifications" : "profile");
  };

  return (
    <main className="mx-auto w-full max-w-2xl pb-12">
      <Hero saved={status === "ready" ? favorites.length : null} />

      <div className="px-4 pt-5">
        <div role="tablist" aria-label="Profile" className="grid grid-cols-2 gap-1 rounded-xl border border-rule bg-surface p-1">
          {(
            [
              ["favorites", "Favorites", <StarIcon key="i" filled={panel === "favorites"} className="size-[18px]" />],
              ["notifications", "Notifications", <Bell key="i" className="size-[18px]" />],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={panel === id}
              onClick={() => choose(id)}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-[15.5px] font-semibold transition ${
                panel === id ? "bg-accent-fill text-on-accent shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {icon}
              {label}
              {id === "notifications" && me.notifications > 0 && panel !== id && <span aria-label="New" className="size-2 rounded-full bg-gold" />}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-5">{panel === "favorites" ? <FavoritesPanel data={data} now={now} /> : <NotificationsPanel />}</div>

      <AccountSection />
    </main>
  );
}

/** The top of the Profile: the person's initial, name and Hamilton email (from their login; HamEats doesn't keep the name). */
function Hero({ saved }: { saved: number | null }) {
  const { data: session } = useSession();
  const name = session?.user?.name?.trim() || "";
  const email = session?.user?.email ?? "";
  const initial = (name || email)[0]?.toUpperCase() ?? "";
  const [busy, setBusy] = useState(false);

  return (
    <section className="bg-band bg-[linear-gradient(to_bottom,transparent_25%,rgb(0_0_0/0.35))] px-4 pb-5 pt-5 text-band-ink">
      <div className="flex items-center gap-4">
        <span aria-hidden className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-gold font-display text-4xl font-bold text-zinc-950 ring-4 ring-band-ink/20">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-[26px] font-bold leading-tight">{name || "Your profile"}</h2>
          {email && <p className="truncate text-[15px] text-band-ink/75">{email}</p>}
          {saved !== null && (
            <p className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold">
              <StarIcon filled className="size-4 text-gold" />
              {saved} {saved === 1 ? "favorite" : "favorites"}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            track("logout_confirmed", { source: "profile" });
            await signOut({ redirect: false }).catch(() => {});
            setBusy(false);
          }}
          className="shrink-0 self-start rounded-full border border-band-ink/40 px-4 py-1.5 text-[14px] font-semibold hover:bg-band-ink/10 disabled:opacity-60"
        >
          {busy ? "Logging out…" : "Log out"}
        </button>
      </div>
    </section>
  );
}

/** Logged out: what the Profile is for, and a way to log in. */
function SignedOut() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-12 pt-5">
      <section className="rounded-[10px] border border-rule bg-surface p-6 text-center shadow-[0_8px_20px_-14px] shadow-black/20">
        <StarIcon filled={false} className="mx-auto size-10 text-gold-ink dark:text-gold" />
        <h2 className="mt-2 font-display text-2xl font-bold">Save your favorite dishes</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-[15px] text-muted">
          Log in with your Hamilton account to star dishes, see when and where each one is served next, and get a morning
          alert when one is on the menu.
        </p>
        <button
          type="button"
          onClick={() => {
            track("login_clicked", { source: "profile" });
            signInWithGoogle();
          }}
          className="mt-5 min-h-12 w-full max-w-xs rounded-full bg-accent-fill px-5 text-base font-semibold text-on-accent"
        >
          Log in
        </button>
      </section>
      <ul className="mt-6 space-y-3 px-1 text-[15px]">
        <li className="flex gap-3">
          <StarIcon filled className="mt-0.5 size-5 shrink-0 text-gold-ink dark:text-gold" />
          <span>
            <strong>Favorites</strong> <span className="text-muted">follow you to any phone or computer you log in on.</span>
          </span>
        </li>
        <li className="flex gap-3">
          <Bell className="mt-0.5 size-5 shrink-0 text-accent" />
          <span>
            <strong>Alerts</strong> <span className="text-muted">at 8 AM tell you which favorites are on that day, where, and for which meal.</span>
          </span>
        </li>
      </ul>
    </main>
  );
}

const linkRow = "flex min-h-12 items-center justify-between py-3 text-[16.5px] font-semibold";

/** Privacy & account: the policies, download my data, and delete my account. */
function AccountSection() {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-4 px-4 pt-10">
      <section>
        <Label>Privacy &amp; account</Label>
        <div className={`${card} divide-y divide-rule`}>
          <a href="/privacy" className={linkRow}>
            Privacy Policy <span aria-hidden className="text-muted">›</span>
          </a>
          <a href="/terms" className={linkRow}>
            Terms <span aria-hidden className="text-muted">›</span>
          </a>
          <a href="/api/me/export" download onClick={() => track("data_downloaded")} className={linkRow}>
            <span>
              Download my data
              <span className="mt-0.5 block text-[13px] font-normal leading-snug text-muted">Your favorites, alert settings and notifications, as a file.</span>
            </span>
            <span aria-hidden className="text-muted">↓</span>
          </a>
        </div>
      </section>

      <section>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-12 w-full rounded-[10px] border border-red-300 bg-surface px-4 text-left text-[16.5px] font-semibold text-red-600 dark:border-red-900 dark:text-red-400"
        >
          Delete account
        </button>
        <p className="mt-2 px-1 text-[13px] text-muted">Deletes your favorites, alert settings and notifications. This can&apos;t be undone.</p>
      </section>

      {confirming && <DeleteAccountDialog onCancel={() => setConfirming(false)} />}
    </div>
  );
}

/** Asks twice (the person types DELETE), then deletes the account, logs out and reloads the app. */
function DeleteAccountDialog({ onCancel }: { onCancel: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = typed.trim().toUpperCase() === "DELETE";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      // Stops this phone's notifications too. serviceWorker.ready never settles without a service worker, so don't wait long.
      await Promise.race([disablePush(), new Promise((r) => setTimeout(r, 3000))]);
      await api("/api/me", "DELETE");
      track("account_deleted");
      await signOut({ redirect: false }).catch(() => {});
      // A full reload, so every part of the app starts again logged out.
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-6" onClick={() => !busy && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-6 text-zinc-700 shadow-xl dark:bg-surface dark:text-zinc-300"
      >
        <h3 id="delete-account-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Delete your account?
        </h3>
        <p className="text-[15px] leading-snug">
          This permanently deletes your favorites, alert settings and notifications. It can&apos;t be undone. You can log in again later,
          but you&apos;ll start fresh.
        </p>
        <label className="block text-[15px]">
          Type <strong className="text-zinc-900 dark:text-zinc-100">DELETE</strong> to confirm
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            className="mt-1.5 block min-h-11 w-full rounded-lg border border-rule bg-background px-3 text-base outline-none focus:border-accent"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full bg-zinc-200/70 px-5 py-2.5 font-semibold text-zinc-900 disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={!ready || busy}
            className="rounded-full bg-red-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}
