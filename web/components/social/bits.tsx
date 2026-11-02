"use client";

import type { ReactNode } from "react";
import { HALL_SHORT } from "@/lib/halls";
import { useKeyboard } from "@/lib/keyboard";

/** "now", "5m", "3h", "2d", then a date. */
export function ago(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  if (minutes < 7 * 1440) return `${Math.round(minutes / 1440)}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const joinedLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";

const stroke = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export function Thumb({ filled, down, className = "size-3.5" }: { filled?: boolean; down?: boolean; className?: string }) {
  return (
    <svg viewBox="2 1.5 20 20" {...stroke} fill={filled ? "currentColor" : "none"} strokeWidth={1.8} className={`${className} ${down ? "-scale-y-100" : ""}`}>
      <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Z" />
      <path d="M7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 1.96 2.4l-1.4 7A2 2 0 0 1 17.1 20H7" />
    </svg>
  );
}

export const Bubble = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="2 2 20 20" {...stroke} strokeWidth={1.8} className={className}>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.8L3 20.5l1.3-4.6A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" />
  </svg>
);

export const Chevron = ({ dir, className = "size-7" }: { dir: "up" | "down"; className?: string }) => (
  <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.4} className={className}>
    <path d={dir === "up" ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
  </svg>
);

export const ChevronRight = ({ className = "size-[18px]" }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M7.2 14.8a.75.75 0 0 1 0-1.06L10.94 10 7.2 6.26a.75.75 0 1 1 1.06-1.06l4.27 4.27a.75.75 0 0 1 0 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0Z" />
  </svg>
);

export const ShareIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" {...stroke} strokeWidth={1.8} className={className}>
    <path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6" />
  </svg>
);

export const Trend = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} className={className}>
    <path d="m3 17 6-6 4 4 8-8M15 7h6v6" />
  </svg>
);

export const CameraIcon = ({ className = "size-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" {...stroke} strokeWidth={1.8} className={className}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

export const LibraryIcon = ({ className = "size-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" {...stroke} strokeWidth={1.8} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 16-5-5-9 9" />
  </svg>
);

export const GearIcon = ({ className = "size-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" {...stroke} strokeWidth={1.8} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

export const CloseIcon = ({ className = "size-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.2} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/** A round avatar: the first letter of a username. */
export function Avatar({ name, size = "size-10", text = "text-lg" }: { name: string; size?: string; text?: string }) {
  return (
    <span aria-hidden className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-accent-fill font-display ${text} font-bold text-on-accent`}>
      {name[0]?.toUpperCase()}
    </span>
  );
}

/** The dining hall flair: an outlined pill, like a flair on Reddit. */
export function HallFlair({ hall }: { hall: string | null }) {
  if (!hall || !HALL_SHORT[hall]) return null;
  return <span className="rounded-full border border-accent px-2 py-px text-xs font-semibold text-accent">{HALL_SHORT[hall]}</span>;
}

/** On a review: whether its writer liked the dish. Added automatically from their thumbs. */
export function VerdictFlair({ verdict }: { verdict: number }) {
  if (verdict !== 1 && verdict !== -1) return null;
  return (
    <span className="flex items-center gap-1 rounded-full bg-accent-fill px-2 py-px text-xs font-semibold text-on-accent">
      <Thumb filled down={verdict === -1} className="size-3" />
      {verdict === -1 ? "Disliked it" : "Liked it"}
    </span>
  );
}

/**
 * A page that covers the whole screen, with a close button, on top of whatever is open. `onClose` should come from
 * useLayers, so the phone's back gesture closes it too.
 */
export function Screen({
  title,
  onClose,
  actions,
  footer,
  children,
  label,
}: {
  title?: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Names the page for screen readers when the title isn't plain text. */
  label: string;
}) {
  const kb = useKeyboard();
  // Escape is handled by the page stack (SocialLayers), so only the top page closes.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      // Always the whole screen. While the keyboard is up, the page keeps covering everything (the keyboard sits over
      // its bottom) and its contents end where the keyboard starts, so the bottom bar (the new post's photo button, a
      // comment box) sits right on top of the keyboard, like Reddit's.
      style={kb ? { top: kb.top, bottom: "auto", height: kb.page, paddingBottom: kb.covered } : undefined}
      className="fixed inset-0 z-50 flex flex-col bg-background text-zinc-900 dark:text-zinc-100"
    >
      <div className="mx-auto flex w-full max-w-2xl items-center gap-1 border-b border-rule px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-zinc-200/60 dark:hover:bg-zinc-800">
          <CloseIcon />
        </button>
        <div className="min-w-0 flex-1">{title}</div>
        {actions}
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </div>
      {footer && <div className="mx-auto w-full max-w-2xl border-t border-rule bg-surface px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">{footer}</div>}
    </div>
  );
}

/**
 * On your own post or comment that nobody else can see: why, and where the rules are. Shown only to its author, the way
 * Reddit labels a removed post for the person who wrote it.
 */
export function HiddenNotice({ why }: { why: "ai" | "reports" }) {
  return (
    <p role="note" className="mt-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] leading-snug text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
      <strong className="font-semibold">Only you can see this.</strong>{" "}
      {why === "ai"
        ? "Our photo filter thought this photo isn't about food, so it's hidden. If it got it wrong, it can be put back."
        : "Several people reported it, so it's hidden from everyone else."}{" "}
      <a href="/rules" className="font-semibold underline">
        See the rules
      </a>
    </p>
  );
}

/** Error codes meant for the app, not for people. Anything else the server says is already written to be shown. */
const TECHNICAL = new Set(["bad request", "not found", "forbidden", "login required", "unavailable", "own"]);

/** The server's error, when it's written to be shown, or `fallback`. */
export function messageFrom(data: { error?: unknown } | null, fallback: string) {
  return typeof data?.error === "string" && !TECHNICAL.has(data.error) ? data.error : fallback;
}

/** A request to the app's API with a JSON body. Resolves to the parsed answer, or throws a message to show. */
export async function api<T = Record<string, unknown>>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  const data = res ? await res.json().catch(() => null) : null;
  if (!res?.ok) throw new Error(messageFrom(data, "That didn't go through. Please try again."));
  return data as T;
}

/** Tells every list on screen that posts changed (one was written or deleted), so they load again. */
export const FEED_CHANGED = "hameats:feed-changed";
export const announceFeedChange = () => window.dispatchEvent(new Event(FEED_CHANGED));
