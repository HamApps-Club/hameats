"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedItem, FeedKind } from "@/lib/social";
import { useMe } from "@/lib/me";
import { signInWithGoogle } from "@/lib/likes";
import { track } from "@/lib/analytics";
import { PostCard } from "@/components/social/PostCard";
import { useOpen } from "@/components/social/SocialLayers";
import { FEED_CHANGED } from "@/components/social/bits";

type Page = { items: FeedItem[]; next: string | null };

const FILTERS: [FeedKind, string][] = [
  ["all", "All"],
  ["review", "Reviews"],
  ["post", "Posts"],
];

const STORAGE_KEY = "feed-filter";
const savedKind = (): FeedKind => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "review" || v === "post" ? v : "all";
  } catch {
    return "all";
  }
};

const feedUrl = (kind: FeedKind, cursor?: string) => {
  const q = new URLSearchParams();
  if (kind !== "all") q.set("kind", kind);
  if (cursor) q.set("cursor", cursor);
  const s = q.toString();
  return `/api/feed${s ? `?${s}` : ""}`;
};

/** The Feed's first page, or null when it couldn't be loaded. */
async function firstPage(kind: FeedKind): Promise<Page | null> {
  const res = await fetch(feedUrl(kind), { cache: "no-store" }).catch(() => null);
  return res?.ok ? ((await res.json()) as Page) : null;
}

/**
 * The Feed: everyone's posts and reviews, newest first, a page at a time as you scroll. Anyone can read it. The Post
 * button opens the new-post page (logged out, it goes to Google login first). `openPostId` is a post to open on
 * arrival, from a shared link (#post-123).
 */
export function FeedTab({ openPostId }: { openPostId: number | null }) {
  const me = useMe();
  const open = useOpen();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [more, setMore] = useState(false);
  // All, only reviews, or only posts. Remembered on this phone, so the Feed opens the way it was left.
  const [kind, setKind] = useState<FeedKind>(savedKind);
  const sentinel = useRef<HTMLDivElement>(null);

  // A failed refresh keeps what's on screen; only a first load that fails says so.
  const show = useCallback((data: Page | null) => {
    if (!data) return setState((s) => (s === "ready" ? s : "error"));
    setItems(data.items);
    setNext(data.next);
    setState("ready");
  }, []);

  const loadMore = useCallback(async () => {
    if (!next || more) return;
    setMore(true);
    const res = await fetch(feedUrl(kind, next), { cache: "no-store" }).catch(() => null);
    if (res?.ok) {
      const data = (await res.json()) as { items: FeedItem[]; next: string | null };
      setItems((list) => [...list, ...data.items.filter((i) => !list.some((x) => x.id === i.id))]);
      setNext(data.next);
    }
    setMore(false);
  }, [next, more, kind]);

  // Loads on arrival and whenever a post or comment changes; a home-screen app also refreshes when it comes back into view.
  useEffect(() => {
    let cancelled = false;
    const load = () => void firstPage(kind).then((data) => !cancelled && show(data));
    load();
    const onChange = () => load();
    const onVisible = () => document.visibilityState === "visible" && load();
    window.addEventListener(FEED_CHANGED, onChange);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener(FEED_CHANGED, onChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [show, kind]);

  // The next page loads as the end of the list comes into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && void loadMore(), { rootMargin: "600px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [next, loadMore]);

  // Opening the Feed clears the gold dot on its tab.
  const { status, clearUnread } = me;
  useEffect(() => {
    if (status !== "in") return;
    clearUnread();
    void fetch("/api/feed/seen", { method: "POST" }).catch(() => {});
  }, [status, clearUnread]);

  const opened = useRef(false);
  useEffect(() => {
    if (openPostId && !opened.current) {
      opened.current = true;
      open.post(openPostId);
    }
  }, [openPostId, open]);

  if (me.status === "off") return <p className="px-4 py-16 text-center text-muted">The Feed isn&apos;t available right now.</p>;

  return (
    <main className="mx-auto max-w-2xl pb-28">
      <div role="group" aria-label="Show in the Feed" className="flex gap-2 border-b border-rule px-3.5 py-3">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => {
              if (k === kind) return;
              setKind(k);
              setState("loading");
              setItems([]);
              setNext(null);
              try {
                localStorage.setItem(STORAGE_KEY, k);
              } catch {}
              track("feed_filtered", { kind: k });
            }}
            className={`min-h-9 rounded-full border px-4 text-[15px] font-semibold ${
              kind === k ? "border-accent bg-accent-fill text-on-accent" : "border-rule bg-surface text-zinc-700 dark:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {state === "loading" && <p className="py-16 text-center text-muted">Loading the Feed…</p>}
      {state === "error" && <p className="px-4 py-16 text-center text-muted">Couldn&apos;t load the Feed. Check your connection and try again.</p>}
      {state === "ready" && items.length === 0 && (
        <div className="px-6 py-16 text-center">
          <p className="font-display text-2xl font-bold">{kind === "review" ? "No reviews yet" : kind === "post" ? "No posts yet" : "Nothing here yet"}</p>
          <p className="mt-2 text-muted">
            {kind === "review" ? "Tap a dish on the Menu to write the first one." : kind === "post" ? "Tap Post to share the first one." : "Be the first: tap Post, or review a dish from the Menu."}
          </p>
        </div>
      )}
      {items.map((item) => (
        <PostCard key={`${item.id}-${item.score}-${item.comments}-${item.author}`} item={item} />
      ))}
      <div ref={sentinel} />
      {more && <p className="py-6 text-center text-sm text-muted">Loading more…</p>}
      {state === "ready" && items.length > 0 && !next && <p className="py-8 text-center text-sm text-muted">You&apos;re all caught up.</p>}

      <button
        type="button"
        onClick={() => {
          track("post_button_clicked", { signed_in: me.status === "in" });
          if (me.status === "in") open.compose();
          else void signInWithGoogle();
        }}
        className="fixed bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))] right-4 z-30 flex h-[52px] items-center gap-2 rounded-full bg-accent-fill pl-4 pr-5 text-lg font-bold text-on-accent shadow-xl shadow-black/30"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden className="size-6">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Post
      </button>
    </main>
  );
}
