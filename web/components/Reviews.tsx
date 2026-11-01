"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { REFRESH_MS, signInWithGoogle, useVotes } from "@/lib/likes";
import { track } from "@/lib/analytics";
import { useMe } from "@/lib/me";
import type { ReviewPlace } from "@/components/ItemSheet";

type Review = { id: number; name: string; body: string; createdAt: string; mine: boolean; reported: boolean; hall: string | null; verdict: number };

const REASONS = [
  "Offensive or hateful",
  "Harassment or targets someone",
  "Spam",
  "Not about food",
  "Something else",
];

const MAX = 500;

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  className: "size-5 shrink-0",
} as const;

/** Your own review's "⋯" button, like Reddit's: opens a small menu with Edit and Delete. */
function ReviewMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 px-4 py-3 text-left text-base hover:bg-zinc-200/60 dark:hover:bg-zinc-800";
  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Review options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-5">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 text-zinc-800 shadow-xl dark:border-zinc-700 dark:bg-surface dark:text-zinc-200"
        >
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className={item}
          >
            <svg {...iconProps}>
              <path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16v4Z" />
              <path d="m13.5 6.5 4 4" />
            </svg>
            Edit
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className={`${item} text-red-600 dark:text-red-400`}
          >
            <svg {...iconProps}>
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/** Like Reddit's "Delete comment?" box: a small window in the middle of the screen. */
export function DeleteDialog({
  busy,
  onCancel,
  onConfirm,
  what = "review",
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** What's being deleted: "review", "post" or "comment". */
  what?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-6"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-review-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-2 rounded-2xl bg-white p-6 text-zinc-700 shadow-xl dark:bg-surface dark:text-zinc-300"
      >
        <h3 id="delete-review-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Delete {what}?
        </h3>
        <p className="text-base">You can&apos;t undo this once it&apos;s deleted.</p>
        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onCancel}
            disabled={busy}
            autoFocus
            className="rounded-full bg-zinc-200/70 px-5 py-2.5 font-semibold text-zinc-900 disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-full bg-red-600 px-5 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Asks why something is being reported, in a small window like the delete one. The reason is optional. */
export function ReportDialog({
  busy,
  onCancel,
  onConfirm,
  what = "review",
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  /** What's being reported: "review", "post" or "comment". */
  what?: string;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-6"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-review-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-2 rounded-2xl bg-white p-6 text-zinc-700 shadow-xl dark:bg-surface dark:text-zinc-300"
      >
        <h3 id="report-review-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Report this {what}?
        </h3>
        <p className="text-base">
          I&apos;ll be notified and will see that it was you. Anything that several people report is hidden.
        </p>
        <fieldset className="space-y-1 pt-2">
          <legend className="sr-only">Reason (optional)</legend>
          {REASONS.map((r) => (
            <label key={r} className="flex min-h-11 items-center gap-3 text-base">
              <input
                type="radio"
                name="report-reason"
                checked={reason === r}
                onChange={() => setReason(r)}
                className="size-4 accent-[var(--accent)]"
              />
              {r}
            </label>
          ))}
        </fieldset>
        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onCancel}
            disabled={busy}
            autoFocus
            className="rounded-full bg-zinc-200/70 px-5 py-2.5 font-semibold text-zinc-900 disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={busy}
            className="rounded-full bg-red-600 px-5 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Reporting…" : "Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** What students have written about a dish. Your own review has a "⋯" menu to edit or delete it; add one below (Google sign-in needed). */
export function Reviews({ dish, place }: { dish: string; place?: ReviewPlace }) {
  const me = useMe();
  const { enabled, setReviews: syncCount } = useVotes();
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [newText, setNewText] = useState("");
  const [editText, setEditText] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reportingId, setReportingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /** The dish's reviews, or null when they couldn't be fetched (so a failed refresh doesn't blank the list). */
  const fetchReviews = useCallback(async (): Promise<Review[] | null> => {
    const res = await fetch(`/api/reviews?dish=${encodeURIComponent(dish)}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return null;
    const list = ((await res.json()) as { reviews: Review[] }).reviews;
    syncCount(dish, list.length);
    return list;
  }, [dish, syncCount]);

  useEffect(() => {
    if (!enabled || status === "loading") return;
    let cancelled = false;
    void fetchReviews().then((fetched) => !cancelled && setReviews(fetched ?? []));
    // The list stays fresh while the page is open: again when the app comes back into view, and every REFRESH_MS.
    // Only the list is replaced, never a box you may be typing in.
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void fetchReviews().then((list) => !cancelled && list && setReviews(list));
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [enabled, status, userId, fetchReviews]);

  // No database connected: the page says reviews are on the way, as before.
  if (!enabled)
    return (
      <section className="rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
        <h3 className="text-xl font-bold">Food reviews coming soon!</h3>
        <p className="mt-1 text-sm text-zinc-500">Soon you&apos;ll be able to rate this food and read what other students think.</p>
      </section>
    );

  const mine = reviews?.find((r) => r.mine);

  const send = async (method: "POST" | "DELETE", body: string) => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/reviews", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dish, body, ...place }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Couldn't save that. Please try again.");
      return false;
    }
    track(method === "POST" ? "review_saved" : "review_deleted", { dish });
    setReviews((await fetchReviews()) ?? []);
    return true;
  };

  const sendReport = async (id: number, reason: string) => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/reviews/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reason }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Couldn't send that report. Please try again.");
      return;
    }
    track("review_reported", { dish, reason });
    setReportingId(null);
    setReviews((await fetchReviews()) ?? []);
  };

  const postNew = async () => {
    if (await send("POST", newText)) setNewText("");
  };
  const saveEdit = async () => {
    if (await send("POST", editText)) setEditing(false);
  };
  const confirmDelete = async () => {
    if (await send("DELETE", "")) {
      setConfirmingDelete(false);
      setEditing(false);
    }
  };

  const box =
    "w-full rounded-lg border border-zinc-300 bg-white p-3 text-base dark:border-zinc-700 dark:bg-surface";
  const primary = "rounded-full bg-accent-fill px-4 py-2 font-semibold text-on-accent disabled:opacity-50";

  return (
    <section id="reviews" className="scroll-mt-16 space-y-4">
      <h3 className="text-xl font-bold">Reviews</h3>

      {reviews === null ? (
        <p className="text-sm text-zinc-500">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-zinc-500">No reviews yet. Be the first!</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              {r.mine && editing ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value.slice(0, MAX))}
                    rows={4}
                    autoFocus
                    aria-label="Edit your review"
                    className={box}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={busy || !editText.trim() || editText.trim() === r.body}
                      className={primary}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setError("");
                      }}
                      disabled={busy}
                      className="rounded-full px-4 py-2 font-medium text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                    <span className="ml-auto text-xs text-zinc-500">
                      {editText.length}/{MAX}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words">{r.body}</p>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-sm text-zinc-500">
                  u/{r.name} · {when(r.createdAt)}
                  {r.mine && (
                    <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">You</span>
                  )}
                </p>
                {!r.mine &&
                  userId &&
                  (r.reported ? (
                    <span className="text-sm text-zinc-500">Reported</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setReportingId(r.id);
                      }}
                      className="min-h-9 rounded-full px-3 text-sm font-medium text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
                    >
                      Report
                    </button>
                  ))}
                {r.mine && !editing && (
                  <ReviewMenu
                    onEdit={() => {
                      setEditText(r.body);
                      setError("");
                      setEditing(true);
                    }}
                    onDelete={() => setConfirmingDelete(true)}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {reviews !== null && !mine && (
        userId ? (
          <div className="space-y-2">
            <label htmlFor="review-text" className="block text-sm font-medium">
              Write a review
            </label>
            <textarea
              id="review-text"
              value={newText}
              onChange={(e) => setNewText(e.target.value.slice(0, MAX))}
              rows={3}
              placeholder="What did you think?"
              className={box}
            />
            <div className="flex items-center gap-2">
              <button onClick={postNew} disabled={busy || !newText.trim()} className={primary}>
                Post review
              </button>
              <span className="ml-auto text-xs text-zinc-500">
                {newText.length}/{MAX}
              </span>
            </div>
            <p className="text-xs text-zinc-500">Shown as u/{me.username ?? "your username"}, in the Feed and on your profile.</p>
          </div>
        ) : (
          <button onClick={() => void signInWithGoogle()} className={primary}>
            Log in with Google to write a review
          </button>
        )
      )}

      {reportingId !== null && (
        <ReportDialog busy={busy} onCancel={() => setReportingId(null)} onConfirm={(reason) => sendReport(reportingId, reason)} />
      )}

      {confirmingDelete && (
        <DeleteDialog busy={busy} onCancel={() => setConfirmingDelete(false)} onConfirm={confirmDelete} />
      )}
    </section>
  );
}
