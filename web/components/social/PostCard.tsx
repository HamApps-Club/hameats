"use client";

import { useState } from "react";
import type { FeedItem } from "@/lib/social";
import { useMe } from "@/lib/me";
import { signInWithGoogle } from "@/lib/likes";
import { track } from "@/lib/analytics";
import { DeleteDialog, ReportDialog } from "@/components/Reviews";
import { useOpen } from "@/components/social/SocialLayers";
import { Avatar, Bubble, Chevron, ChevronRight, HallFlair, HiddenNotice, ShareIcon, Trend, VerdictFlair, ago, announceFeedChange, api } from "@/components/social/bits";

/** The up and down arrows with the score between them, like Reddit's. Logged out, a tap goes to Google login. */
export function VoteColumn({ target, id, score: start, myVote: startVote }: { target: "post" | "comment"; id: number; score: number; myVote: number }) {
  const { status } = useMe();
  const [score, setScore] = useState(start);
  const [mine, setMine] = useState(startVote);
  const small = target === "comment";
  const cast = (dir: 1 | -1) => {
    if (status !== "in") return void signInWithGoogle();
    const next = mine === dir ? 0 : dir;
    const before = { score, mine };
    setMine(next);
    setScore(score - mine + next);
    track("feed_vote", { target, value: next });
    api<{ score: number }>("/api/votes", "POST", { target, id, value: next })
      .then((r) => setScore(r.score))
      .catch(() => {
        setMine(before.mine);
        setScore(before.score);
      });
  };
  return (
    <div className={`flex items-center text-accent ${small ? "flex-row gap-0.5" : "w-11 flex-col"}`}>
      <button type="button" aria-label={small ? "Upvote comment" : "Upvote"} aria-pressed={mine === 1} onClick={() => cast(1)} className={mine === 1 ? "" : "text-muted"}>
        <Chevron dir="up" className={small ? "size-6" : "size-[30px]"} />
      </button>
      <span aria-live="polite" className={`font-bold tabular-nums ${small ? "min-w-6 text-center text-[14px]" : "text-[22px]"}`}>
        {score}
      </span>
      <button type="button" aria-label={small ? "Downvote comment" : "Downvote"} aria-pressed={mine === -1} onClick={() => cast(-1)} className={mine === -1 ? "" : "text-muted"}>
        <Chevron dir="down" className={small ? "size-6" : "size-[30px]"} />
      </button>
    </div>
  );
}

/**
 * One post or review in the Feed (and on profiles). The writer's username and avatar open their profile; the words,
 * the photo and the comment count open the post; a review's dish box opens every review of that dish.
 */
export function PostCard({ item, inThread = false }: { item: FeedItem; inThread?: boolean }) {
  const open = useOpen();
  const { status } = useMe();
  const [reported, setReported] = useState(item.reported);
  const [dialog, setDialog] = useState<"report" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const what = item.kind === "review" ? "review" : "post";
  const openPost = () => !inThread && open.post(item.id);

  const share = async () => {
    const url = `${window.location.origin}/#post-${item.id}`;
    const text = item.dish ? `${item.dish}: ${item.body}` : item.body;
    track("post_shared", { kind: item.kind });
    try {
      if (navigator.share) await navigator.share({ title: "HamEats", text, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // Cancelled, or sharing isn't allowed here: nothing to do.
    }
  };

  const report = async (reason: string) => {
    setBusy(true);
    try {
      await api("/api/report", "POST", { postId: item.id, reason });
      setReported(true);
      setDialog(null);
      track("post_reported", { kind: item.kind, reason });
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api("/api/posts", "DELETE", { id: item.id });
      setDialog(null);
      track("post_deleted", { kind: item.kind });
      announceFeedChange();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <article className="relative border-b border-rule py-3.5 pl-3.5 pr-16">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => open.profile(item.author)} aria-label={`u/${item.author}'s profile`} className="shrink-0 rounded-full">
          <Avatar name={item.author} size="size-11" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-base">
            <button type="button" onClick={() => open.profile(item.author)} className="font-bold hover:underline">
              u/{item.author}
            </button>{" "}
            <span className="text-sm text-muted">· {ago(item.createdAt)}</span>
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <HallFlair hall={item.hall} />
            {item.kind === "review" && <VerdictFlair verdict={item.verdict} />}
          </div>
        </div>
      </div>

      {item.mine && item.hidden && <HiddenNotice why={item.hidden} />}
      {item.body && (
        <button type="button" onClick={openPost} disabled={inThread} className="mt-2.5 block w-full text-left text-[18px] leading-snug [overflow-wrap:anywhere] whitespace-pre-wrap disabled:cursor-text">
          {item.body}
        </button>
      )}
      {item.photo && (
        <button type="button" onClick={openPost} disabled={inThread} aria-label="Open the post" className="mt-3 block w-full disabled:cursor-default">
          {/* eslint-disable-next-line @next/next/no-img-element -- a stored photo, already sized and compressed when it was uploaded */}
          <img
            src={item.photo.url}
            alt={item.body ? `Photo with u/${item.author}'s post` : `Photo posted by u/${item.author}`}
            width={item.photo.width}
            height={item.photo.height}
            loading="lazy"
            decoding="async"
            className="max-h-[28rem] w-full rounded-xl border border-rule bg-surface object-cover"
          />
        </button>
      )}
      {item.kind === "review" && item.dish && (
        <button
          type="button"
          onClick={() => open.dish(item.dish!, item.hall)}
          className="mt-3 flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-rule bg-surface px-3.5 text-left text-[15px] hover:border-accent/50"
        >
          <Trend className="size-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate font-semibold">{item.dish}</span>
          <span className="shrink-0 text-[13px] text-muted">
            {item.dishReviews} {item.dishReviews === 1 ? "review" : "reviews"}
          </span>
          <ChevronRight className="size-[18px] shrink-0 text-muted" />
        </button>
      )}

      <div className="mt-3 flex items-center gap-6 text-muted">
        <button type="button" onClick={openPost} disabled={inThread} aria-label={`${item.comments} ${item.comments === 1 ? "comment" : "comments"}`} className="flex min-h-9 items-center gap-1.5 text-[13px] tabular-nums disabled:cursor-default">
          <Bubble className="size-[22px]" />
          {item.comments}
        </button>
        <button type="button" onClick={() => void share()} aria-label="Share" className="flex min-h-9 items-center gap-1.5 text-[13px]">
          <ShareIcon className="size-[22px]" />
          {copied && "Link copied"}
        </button>
        {item.mine ? (
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
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="absolute right-2.5 top-3.5">
        <VoteColumn target="post" id={item.id} score={item.score} myVote={item.myVote} />
      </div>

      {dialog === "report" && <ReportDialog what={what} busy={busy} onCancel={() => setDialog(null)} onConfirm={(r) => void report(r)} />}
      {dialog === "delete" && <DeleteDialog what={what} busy={busy} onCancel={() => setDialog(null)} onConfirm={() => void remove()} />}
    </article>
  );
}
