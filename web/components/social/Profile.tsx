"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import type { PublicProfile } from "@/lib/social";
import { useMe } from "@/lib/me";
import { useVotes } from "@/lib/likes";
import { usernameProblem } from "@/lib/usernames";
import { track } from "@/lib/analytics";
import { PostCard } from "@/components/social/PostCard";
import { useOpen } from "@/components/social/SocialLayers";
import { FEED_CHANGED, GearIcon, Screen, Thumb, ago, api, joinedLabel } from "@/components/social/bits";

type Tab = "Posts" | "Comments" | "Liked" | "Disliked";
type Kind = "all" | "post" | "review";

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

/** The tabs and lists under a profile's header. */
function ProfileBody({ profile, own }: { profile: PublicProfile; own: boolean }) {
  const open = useOpen();
  const { mine } = useVotes();
  const [tab, setTab] = useState<Tab>("Posts");
  const [kind, setKind] = useState<Kind>("all");
  // Your own thumbs come from the Menu's live state, so taking one back here shows at once.
  const liked = own ? Object.keys(mine).filter((d) => mine[d] === 1).sort() : profile.liked;
  const disliked = own ? Object.keys(mine).filter((d) => mine[d] === -1).sort() : [];
  const posts = kind === "all" ? profile.posts : profile.posts.filter((p) => p.kind === kind);
  const tabs: [Tab, number][] = [
    ["Posts", profile.posts.length],
    ["Comments", profile.comments.length],
    ["Liked", liked.length],
    ...(own ? ([["Disliked", disliked.length]] as [Tab, number][]) : []),
  ];
  const filters: [Kind, string][] = [
    ["all", "All"],
    ["post", "Posts"],
    ["review", "Reviews"],
  ];
  return (
    <>
      <div role="tablist" aria-label={`u/${profile.username}'s activity`} className="flex overflow-x-auto border-b border-rule">
        {tabs.map(([t, n]) => (
          <button key={t} role="tab" aria-selected={t === tab} onClick={() => setTab(t)} className={`-mb-px flex-1 whitespace-nowrap border-b-2 px-2 py-3 text-[15px] font-bold ${t === tab ? "border-accent text-accent" : "border-transparent text-muted"}`}>
            {t} <span className="font-semibold tabular-nums">{n}</span>
          </button>
        ))}
      </div>
      <div className="space-y-3 pb-12 pt-4">
        {tab === "Posts" && (
          <>
            {profile.posts.length > 0 && (
              <div role="group" aria-label="Show" className="flex gap-2 px-3.5">
                {filters.map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-9 rounded-full border px-4 text-[14px] font-semibold ${kind === k ? "border-accent bg-accent-fill text-on-accent" : "border-rule bg-surface"}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {posts.length ? (
              <div className="border-t border-rule">
                {posts.map((p) => (
                  <PostCard key={`${p.id}-${p.score}-${p.comments}`} item={p} />
                ))}
              </div>
            ) : (
              <Empty title="Nothing here yet" hint={own ? "Tap Post in the Feed, or review a dish from the Menu." : undefined} />
            )}
          </>
        )}
        {tab === "Comments" &&
          (profile.comments.length ? (
            <ul className="space-y-3 px-3.5">
              {profile.comments.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => open.post(c.postId)} className="block w-full rounded-[10px] border border-rule bg-surface p-4 text-left shadow-[0_8px_20px_-14px] shadow-black/20 hover:border-accent/50">
                    <p className="text-sm text-muted">
                      On <b className="font-semibold">u/{c.on}</b>&apos;s post · {ago(c.createdAt)}
                    </p>
                    <p className="mt-1 truncate text-[13px] italic text-muted">&ldquo;{c.snippet}&rdquo;</p>
                    <p className="mt-2 whitespace-pre-wrap text-[16px] leading-snug [overflow-wrap:anywhere]">{c.body}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No comments yet" hint={own ? "Open a post in the Feed to join the conversation." : undefined} />
          ))}
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

/** The Me tab: your own profile, with Edit (your username) and Settings. */
export function MeTab() {
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
      <ProfileBody profile={profile} own />
    </main>
  );
}
