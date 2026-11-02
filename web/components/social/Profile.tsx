"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import type { FeedItem, NotificationItem, ProfileComment, PublicProfile } from "@/lib/social";
import { useMe } from "@/lib/me";
import { useVotes } from "@/lib/likes";
import { usernameProblem } from "@/lib/usernames";
import { track } from "@/lib/analytics";
import { PostCard } from "@/components/social/PostCard";
import { useOpen } from "@/components/social/SocialLayers";
import { Bubble, ChevronRight, FEED_CHANGED, GearIcon, Screen, Thumb, ago, api, joinedLabel } from "@/components/social/bits";

type Tab = "Posts" | "Notifications" | "Liked" | "Disliked";
type Kind = "all" | "post" | "review" | "comment";

/** The top of a profile, laid out like Reddit's: a blue header with a big avatar, the name, when they joined, and counts. */
function Hero({ profile, edit, actions }: { profile: PublicProfile; edit?: ReactNode; actions?: ReactNode }) {
  const posts = profile.posts.filter((p) => p.kind === "post").length;
  const reviews = profile.posts.filter((p) => p.kind === "review").length;
  const stats: [number, string][] = [
    [posts, posts === 1 ? "Post" : "Posts"],
    [reviews, reviews === 1 ? "Review" : "Reviews"],
    [profile.comments.length, profile.comments.length === 1 ? "Comment" : "Comments"],
  ];
  return (
    <section className="bg-band bg-[linear-gradient(to_bottom,transparent_25%,rgb(0_0_0/0.4))] px-4 pb-4 pt-3 text-band-ink">
      <div className="flex min-h-11 items-center justify-end">{actions}</div>
      <span aria-hidden className="flex size-[88px] items-center justify-center rounded-full bg-gold font-display text-5xl font-bold text-zinc-950 ring-4 ring-band-ink/20">
        {profile.username[0]?.toUpperCase()}
      </span>
      <div className="mt-4 flex items-center gap-3">
        <h2 className="min-w-0 truncate font-display text-[26px] font-bold leading-none min-[400px]:text-[30px]">u/{profile.username}</h2>
        {edit}
      </div>
      <p className="mt-1.5 text-[15px] text-band-ink/75">Joined {joinedLabel(profile.joined)}</p>
      <dl className="mt-4 grid grid-cols-3 divide-x divide-band-ink/20 border-t border-band-ink/20 pt-3 text-center">
        {stats.map(([value, label]) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="text-xs text-band-ink/70">{label}</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mx-3.5 rounded-xl border border-dashed border-rule p-8 text-center text-muted">
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm">{hint}</p>}
    </div>
  );
}

/** A list of dishes with their hall. On your own profile, the button takes the thumbs back. */
function DishList({ dishes, dir, own }: { dishes: string[]; dir: 1 | -1; own: boolean }) {
  const { cast } = useVotes();
  const word = dir === 1 ? "Liked" : "Disliked";
  if (!dishes.length)
    return <Empty title={`No ${word.toLowerCase()} dishes yet`} hint={own ? `Give a dish a thumbs ${dir === 1 ? "up" : "down"} on the Menu and it shows up here.` : undefined} />;
  return (
    <ul className="mx-3.5 divide-y divide-rule rounded-[10px] border border-rule bg-surface px-4 shadow-[0_8px_20px_-14px] shadow-black/20">
      {dishes.map((d) => (
        <li key={d} className="flex items-center gap-3 py-3">
          <p className="min-w-0 flex-1 text-[16.5px]">{d}</p>
          {own ? (
            <button type="button" onClick={() => cast(d, dir)} aria-label={`Take back your thumbs ${dir === 1 ? "up" : "down"} on ${d}`} className="flex min-h-9 items-center gap-1 rounded-full border border-rule px-3 text-[13px] font-semibold text-accent hover:bg-accent/10">
              <Thumb filled down={dir === -1} className="size-4" />
              {word}
            </button>
          ) : (
            <Thumb filled down={dir === -1} className="size-4 text-accent" />
          )}
        </li>
      ))}
    </ul>
  );
}

/** One of the person's comments, in the profile's list: which post it's on, and what they wrote. Opens the post. */
function CommentRow({ c }: { c: ProfileComment }) {
  const open = useOpen();
  return (
    <article className="border-b border-rule">
      <button type="button" onClick={() => open.post(c.postId)} className="block w-full px-3.5 py-3.5 text-left hover:bg-accent/5">
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Bubble className="size-4 shrink-0 text-accent" />
          <span className="truncate">
            Commented on <b className="font-semibold">u/{c.on}</b>&apos;s post · {ago(c.createdAt)}
          </span>
        </p>
        <p className="mt-1 truncate text-[13px] italic text-muted">&ldquo;{c.snippet}&rdquo;</p>
        <p className="mt-2 whitespace-pre-wrap text-[16px] leading-snug [overflow-wrap:anywhere]">{c.body}</p>
      </button>
    </article>
  );
}

const Bell = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const MEAL_TIME = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Opens a dining hall's menu (its page lives at #slug). */
function openHall(slug: string) {
  history.pushState(null, "", `#${slug}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  window.scrollTo({ top: 0 });
}

/**
 * Your notifications: the morning alerts, each listing the liked dishes on that day's menu with their hall and meal
 * (tap one for that hall's menu). Opening the tab marks them all read, which clears the dot on the Me tab; the ones that
 * were new keep a gold dot until you leave.
 */
function NotificationsList() {
  const me = useMe();
  const open = useOpen();
  const { clearNotifications } = me;
  const [list, setList] = useState<NotificationItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Notifications shown as new: unread when they loaded here. Kept while the tab is open, even once marked read.
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

  if (!list) return <p className="py-10 text-center text-muted">{failed ? "Couldn't load your notifications. Check your connection and try again." : "Loading…"}</p>;
  if (!list.length)
    return (
      <div className="mx-3.5 rounded-xl border border-dashed border-rule p-8 text-center text-muted">
        <p className="font-semibold">No notifications yet</p>
        <p className="mt-1 text-sm">Like dishes on the Menu and turn on alerts. At 8 AM we&apos;ll tell you which ones are served that day, where, and for which meal.</p>
        <button type="button" onClick={open.settings} className="mt-4 rounded-full border border-rule bg-surface px-4 py-2 text-[14px] font-semibold text-accent hover:border-accent/50">
          Alert settings
        </button>
      </div>
    );
  return (
    <ul className="border-t border-rule">
      {list.map((n) => (
        <li key={n.id} className="border-b border-rule px-3.5 py-3.5">
          <div className="flex items-start gap-3">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-band text-band-ink">
              <Bell className="size-[22px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm text-muted">
                <span className="font-semibold text-foreground">HamEats</span>
                <span>· {MEAL_TIME.format(new Date(n.createdAt))}</span>
                {fresh.has(n.id) && <span aria-label="New" className="ml-auto size-[9px] shrink-0 rounded-full bg-gold" />}
              </p>
              <p className="mt-0.5 text-[17px] font-bold leading-snug">{n.title}</p>
              {n.items.length ? (
                <ul className="mt-2 divide-y divide-rule rounded-[10px] border border-rule bg-surface">
                  {groupItems(n.items).map((g) => (
                    <li key={`${g.dish}|${g.hall}`}>
                      <button type="button" onClick={() => openHall(g.hall)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-accent/5">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[16px] font-semibold leading-snug">{g.dish}</span>
                          <span className="block text-[13.5px] text-muted">
                            {HALL_NAME[g.hall] ?? g.hall} · {g.meals.join(", ")}
                          </span>
                        </span>
                        <ChevronRight className="size-[18px] shrink-0 text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-[15px] leading-snug">{n.body}</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

const HALL_NAME: Record<string, string> = { commons: "Soper Commons", mcewen: "McEwen", diner: "Howard Diner", "little-pub": "Little Pub" };
const MEALS = ["Breakfast", "Lunch", "Dinner"];

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
 * The tabs and lists under a profile's header. Posts has pills for All, Posts, Reviews and Comments. Notifications is
 * only on your own profile; `notifications` opens it (the #notifications address, where tapping a notification goes).
 */
function ProfileBody({ profile, own, notifications = false }: { profile: PublicProfile; own: boolean; notifications?: boolean }) {
  const { mine } = useVotes();
  const me = useMe();
  const [tab, setTabState] = useState<Tab>(own && notifications ? "Notifications" : "Posts");
  const [kind, setKind] = useState<Kind>("all");
  // Another tap on a notification while you're on a different tab brings you back to Notifications.
  const [wasNotifications, setWasNotifications] = useState(notifications);
  if (notifications !== wasNotifications) {
    setWasNotifications(notifications);
    if (own && notifications) setTabState("Notifications");
  }
  // On your own profile the address follows the Notifications tab, so a notification tapped later always opens it.
  const setTab = (t: Tab) => {
    setTabState(t);
    if (!own) return;
    const want = t === "Notifications" ? "#notifications" : "#me";
    if (window.location.hash !== want) history.replaceState(history.state, "", want);
  };
  // Your own thumbs come from the Menu's live state, so taking one back here shows at once.
  const liked = own ? Object.keys(mine).filter((d) => mine[d] === 1).sort() : profile.liked;
  const disliked = own ? Object.keys(mine).filter((d) => mine[d] === -1).sort() : [];
  // All: posts, reviews and comments together, newest first.
  type Entry = { at: string; post?: FeedItem; comment?: ProfileComment };
  const entries: Entry[] =
    kind === "comment"
      ? profile.comments.map((c) => ({ at: c.createdAt, comment: c }))
      : kind === "all"
        ? [...profile.posts.map((p) => ({ at: p.createdAt, post: p })), ...profile.comments.map((c) => ({ at: c.createdAt, comment: c }))].sort((a, b) =>
            b.at.localeCompare(a.at),
          )
        : profile.posts.filter((p) => p.kind === kind).map((p) => ({ at: p.createdAt, post: p }));
  const activity = profile.posts.length + profile.comments.length;
  const tabs: [Tab, number | null][] = [
    ["Posts", activity],
    ...(own ? ([["Notifications", null]] as [Tab, null][]) : []),
    ["Liked", liked.length],
    ...(own ? ([["Disliked", disliked.length]] as [Tab, number][]) : []),
  ];
  const filters: [Kind, string][] = [
    ["all", "All"],
    ["post", "Posts"],
    ["review", "Reviews"],
    ["comment", "Comments"],
  ];
  const emptyHint: Record<Kind, string> = {
    all: "Tap Post in the Feed, or review a dish from the Menu.",
    post: "Tap Post in the Feed to share something.",
    review: "Review a dish from the Menu.",
    comment: "Open a post in the Feed to join the conversation.",
  };
  return (
    <>
      <div role="tablist" aria-label={`u/${profile.username}'s activity`} className="flex overflow-x-auto border-b border-rule">
        {tabs.map(([t, n]) => (
          <button key={t} role="tab" aria-selected={t === tab} onClick={() => setTab(t)} className={`-mb-px flex flex-1 items-center justify-center gap-1 whitespace-nowrap border-b-2 px-2 py-3 text-[15px] font-bold ${t === tab ? "border-accent text-accent" : "border-transparent text-muted"}`}>
            {t} {n !== null && <span className="font-semibold tabular-nums">{n}</span>}
            {t === "Notifications" && me.notifications > 0 && <span aria-label={`${me.notifications} new`} className="size-[9px] rounded-full bg-gold" />}
          </button>
        ))}
      </div>
      <div className="space-y-3 pb-12 pt-4">
        {tab === "Posts" && (
          <>
            {activity > 0 && (
              <div role="group" aria-label="Show" className="flex gap-2 overflow-x-auto px-3.5">
                {filters.map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-9 shrink-0 rounded-full border px-4 text-[14px] font-semibold ${kind === k ? "border-accent bg-accent-fill text-on-accent" : "border-rule bg-surface"}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {entries.length ? (
              <div className="border-t border-rule">
                {entries.map((e) =>
                  e.post ? <PostCard key={`p${e.post.id}-${e.post.score}-${e.post.comments}`} item={e.post} /> : <CommentRow key={`c${e.comment!.id}`} c={e.comment!} />,
                )}
              </div>
            ) : (
              <Empty title={kind === "comment" ? "No comments yet" : "Nothing here yet"} hint={own ? emptyHint[kind] : undefined} />
            )}
          </>
        )}
        {tab === "Notifications" && own && <NotificationsList />}
        {tab === "Liked" && <DishList dishes={liked} dir={1} own={own} />}
        {tab === "Disliked" && own && <DishList dishes={disliked} dir={-1} own />}
      </div>
    </>
  );
}

async function fetchProfile(username: string): Promise<PublicProfile | "missing" | null> {
  const res = await fetch(`/api/users/${encodeURIComponent(username)}`, { cache: "no-store" }).catch(() => null);
  if (res?.status === 404) return "missing";
  return res?.ok ? res.json() : null;
}

/** Loads a profile, and again whenever a post or comment is added or deleted anywhere. */
function useProfile(username: string | null) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    const load = () =>
      void fetchProfile(username).then((got) => {
        if (cancelled) return;
        if (got === "missing") return setState("missing");
        if (!got) return setState((s) => (s === "ready" ? s : "error"));
        setProfile(got);
        setState("ready");
      });
    load();
    window.addEventListener(FEED_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(FEED_CHANGED, load);
    };
  }, [username]);
  return { profile, state };
}

/** Someone's profile, opened from their username anywhere in the app. */
export function ProfileScreen({ username, onClose }: { username: string; onClose: () => void }) {
  const { profile, state } = useProfile(username);
  return (
    <Screen label={`u/${username}`} onClose={onClose} title={<h2 className="truncate font-display text-xl font-bold">u/{username}</h2>}>
      {state === "loading" && <p className="py-16 text-center text-muted">Loading…</p>}
      {state === "missing" && <p className="py-16 text-center text-muted">There&apos;s no one called u/{username}. They may have changed their username.</p>}
      {state === "error" && <p className="py-16 text-center text-muted">Couldn&apos;t load this profile. Check your connection and try again.</p>}
      {state === "ready" && profile && (
        <>
          <Hero profile={profile} />
          <ProfileBody profile={profile} own={profile.mine} />
        </>
      )}
    </Screen>
  );
}

/** Changing your username, with a live check as you type. The server's check is the one that counts. */
function RenameForm({ current, onDone }: { current: string; onDone: (name?: string) => void }) {
  const [draft, setDraft] = useState(current);
  const [live, setLive] = useState<{ name: string; problem: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const typed = draft.trim();
  const local = typed && typed !== current ? usernameProblem(typed) : null;

  // Asks the server whether the name is free, once typing pauses.
  useEffect(() => {
    if (!typed || typed === current || local) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/username?name=${encodeURIComponent(typed)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => !cancelled && b && setLive({ name: typed, problem: b.problem ?? null }))
        .catch(() => {});
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [typed, current, local]);

  const checked = live?.name === typed ? live : null;
  const message = error ?? local ?? checked?.problem ?? null;
  const available = !!typed && typed !== current && !local && checked?.problem === null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ username: string }>("/api/me", "PATCH", { username: typed });
      track("username_changed");
      onDone(r.username);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <form
      className="mx-3.5 mt-4 space-y-2 rounded-[10px] border border-rule bg-surface p-4 shadow-[0_8px_20px_-14px] shadow-black/20"
      onSubmit={(e) => {
        e.preventDefault();
        if (typed && typed !== current) void save();
      }}
    >
      <label htmlFor={id} className="block text-sm font-semibold">
        New username
      </label>
      <div className="flex items-center rounded-xl border border-rule bg-background focus-within:border-accent">
        <span className="pl-3 text-muted" aria-hidden>
          u/
        </span>
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          maxLength={20}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={!!message}
          aria-describedby={`${id}-hint`}
          className="min-h-12 w-full bg-transparent px-1.5 text-base outline-none"
        />
      </div>
      <p id={`${id}-hint`} role={message ? "alert" : available ? "status" : undefined} className={`text-[13px] ${message ? "text-red-600 dark:text-red-400" : available ? "font-semibold text-accent" : "text-muted"}`}>
        {message ?? (available ? `u/${typed} is available` : "3 to 20 letters, numbers or underscores. This is the only name other students see.")}
      </p>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={busy || !typed || typed === current || !!local} className="rounded-full bg-accent-fill px-5 py-2.5 font-semibold text-on-accent disabled:opacity-50">
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => onDone()} className="rounded-full px-4 py-2.5 font-medium text-muted hover:bg-zinc-200/60 dark:hover:bg-zinc-800">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** The Me tab: your own profile, with Edit (your username), Settings and your Notifications (`notifications` opens them). */
export function MeTab({ notifications = false }: { notifications?: boolean }) {
  const me = useMe();
  const open = useOpen();
  const { profile, state } = useProfile(me.status === "in" ? me.username : null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  if (me.status === "off") return <p className="px-4 py-16 text-center text-muted">Profiles aren&apos;t available right now.</p>;
  if (me.status === "out") return <p className="px-4 py-16 text-center text-[17px] text-muted">Log in to see your profile.</p>;
  if (me.status === "loading" || state === "loading" || !profile)
    return <p className="py-16 text-center text-muted">{state === "error" ? "Couldn't load your profile. Check your connection and try again." : "Loading…"}</p>;

  return (
    <main className="mx-auto max-w-2xl">
      <Hero
        profile={profile}
        actions={
          <button type="button" onClick={open.settings} aria-label="Settings" className="flex size-11 items-center justify-center rounded-full border border-band-ink/30 bg-band-ink/10">
            <GearIcon />
          </button>
        }
        edit={
          !editing && (
            <button
              type="button"
              onClick={() => {
                setSaved(null);
                setEditing(true);
              }}
              aria-label="Change username"
              className="shrink-0 rounded-full border border-band-ink/40 px-4 py-1.5 text-[15px] font-semibold hover:bg-band-ink/10"
            >
              Edit
            </button>
          )
        }
      />
      {saved && !editing && (
        <p role="status" className="px-4 pt-3 text-[13px] font-semibold text-accent">
          You&apos;re now u/{saved}
        </p>
      )}
      {editing && (
        <RenameForm
          current={profile.username}
          onDone={(name) => {
            setEditing(false);
            if (name) {
              setSaved(name);
              me.setUsername(name);
            }
          }}
        />
      )}
      {/* A new username loads the profile again by itself (useProfile follows me.username). */}
      <ProfileBody profile={profile} own notifications={notifications} />
    </main>
  );
}
