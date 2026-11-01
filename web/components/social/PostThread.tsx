"use client";

import { useEffect, useState } from "react";
import type { CommentItem, FeedItem } from "@/lib/social";
import { useMe } from "@/lib/me";
import { signInWithGoogle } from "@/lib/likes";
import { track } from "@/lib/analytics";
import { DeleteDialog, ReportDialog } from "@/components/Reviews";
import { PostCard, VoteColumn } from "@/components/social/PostCard";
import { useOpen } from "@/components/social/SocialLayers";
import { Avatar, FEED_CHANGED, Screen, ago, announceFeedChange, api } from "@/components/social/bits";

const MAX_COMMENT = 500;

function Comment({ c, onChanged }: { c: CommentItem; onChanged: () => void }) {
  const open = useOpen();
  const { status } = useMe();
  const [dialog, setDialog] = useState<"report" | "delete" | null>(null);
  const [reported, setReported] = useState(c.reported);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setDialog(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <li className="border-b border-rule px-4 py-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => open.profile(c.author)} aria-label={`u/${c.author}'s profile`} className="shrink-0 rounded-full">
          <Avatar name={c.author} size="size-7" text="text-sm" />
        </button>
        <p className="min-w-0 truncate text-[15px]">
          <button type="button" onClick={() => open.profile(c.author)} className="font-bold hover:underline">
            u/{c.author}
          </button>{" "}
          <span className="text-[13px] text-muted">· {ago(c.createdAt)}</span>
        </p>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-[16.5px] leading-snug [overflow-wrap:anywhere]">{c.body}</p>
      <div className="mt-1 flex items-center gap-4 text-muted">
        <VoteColumn target="comment" id={c.id} score={c.score} myVote={c.myVote} />
        {c.mine ? (
          <button type="button" onClick={() => setDialog("delete")} className="min-h-9 text-[13px] font-semibold hover:text-red-600 dark:hover:text-red-400">
            Delete
          </button>
        ) : (
          status === "in" &&
          (reported ? (
            <span className="text-[13px]">Reported</span>
          ) : (
            <button type="button" onClick={() => setDialog("report")} className="min-h-9 text-[13px] font-semibold">
              Report
            </button>
          ))
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {dialog === "report" && (
        <ReportDialog
          what="comment"
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) =>
            void act(async () => {
              await api("/api/report", "POST", { commentId: c.id, reason });
              setReported(true);
              track("comment_reported", { reason });
            })
          }
        />
      )}
      {dialog === "delete" && (
        <DeleteDialog
          what="comment"
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() =>
            void act(async () => {
              await api("/api/comments", "DELETE", { id: c.id });
              track("comment_deleted");
              onChanged();
            })
          }
        />
      )}
    </li>
  );
}

/** A post and its comments; "missing" when it was deleted, null when it couldn't be loaded. */
async function fetchThread(id: number): Promise<{ post: FeedItem; comments: CommentItem[] } | "missing" | null> {
  const res = await fetch(`/api/posts/${id}`, { cache: "no-store" }).catch(() => null);
  if (res?.status === 404) return "missing";
  return res?.ok ? res.json() : null;
}

/** One post with its comments, like opening a post on Reddit. Anyone can read; commenting and voting need a login. */
export function PostThread({ id, onClose }: { id: number; onClose: () => void }) {
  const { status } = useMe();
  const [post, setPost] = useState<FeedItem | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      void fetchThread(id).then((got) => {
        if (cancelled) return;
        if (got === "missing") return setState("missing");
        if (!got) return setState((s) => (s === "ready" ? s : "error"));
        setPost(got.post);
        setComments(got.comments);
        setState("ready");
      });
    load();
    window.addEventListener(FEED_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(FEED_CHANGED, load);
    };
  }, [id]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/comments", "POST", { postId: id, body });
      setText("");
      track("comment_added");
      announceFeedChange();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <Screen
      label="Post"
      onClose={onClose}
      title={<h2 className="font-display text-xl font-bold">Post</h2>}
      footer={
        state === "ready" &&
        (status === "in" ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_COMMENT))}
              aria-label="Add a comment"
              placeholder="Add a comment"
              enterKeyHint="send"
              className="min-h-11 min-w-0 flex-1 rounded-full border border-rule bg-background px-4 text-base outline-none focus:border-accent"
            />
            <button type="submit" disabled={busy || !text.trim()} className="min-h-11 rounded-full bg-accent-fill px-5 text-base font-bold text-on-accent disabled:opacity-40">
              {busy ? "Sending…" : "Send"}
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => void signInWithGoogle()} className="min-h-11 w-full rounded-full border border-rule bg-background text-base font-semibold text-accent">
            Log in to comment
          </button>
        ))
      }
    >
      {state === "loading" && <p className="py-16 text-center text-muted">Loading…</p>}
      {state === "error" && <p className="py-16 text-center text-muted">Couldn&apos;t load this post. Check your connection and try again.</p>}
      {state === "missing" && <p className="py-16 text-center text-muted">This post was deleted.</p>}
      {state === "ready" && post && (
        <>
          <PostCard key={`${post.id}-${post.score}-${post.comments}`} item={post} inThread />
          <h3 className="px-4 pb-1 pt-3 text-sm font-bold text-muted">
            {comments.length} {comments.length === 1 ? "comment" : "comments"}
          </h3>
          {error && <p className="px-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {comments.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted">
              <b className="block font-semibold">No comments yet</b>
              <span className="text-sm">Start the conversation.</span>
            </p>
          ) : (
            <ul>
              {comments.map((c) => (
                <Comment key={`${c.id}-${c.score}`} c={c} onChanged={announceFeedChange} />
              ))}
            </ul>
          )}
        </>
      )}
    </Screen>
  );
}
