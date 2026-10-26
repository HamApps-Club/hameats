"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { signInWithGoogle, useLikes } from "@/lib/likes";
import { track } from "@/lib/analytics";

type Review = { name: string; body: string; createdAt: string; mine: boolean };

const MAX = 500;

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** What students have written about a dish, and a box to add your own (Google sign-in needed). */
export function Reviews({ dish }: { dish: string }) {
  const { enabled } = useLikes();
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchReviews = useCallback(async (): Promise<Review[]> => {
    const res = await fetch(`/api/reviews?dish=${encodeURIComponent(dish)}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return [];
    return ((await res.json()) as { reviews: Review[] }).reviews;
  }, [dish]);

  const show = (list: Review[]) => {
    setReviews(list);
    setText(list.find((r) => r.mine)?.body ?? "");
  };

  useEffect(() => {
    if (!enabled || status === "loading") return;
    let cancelled = false;
    void fetchReviews().then((list) => {
      if (cancelled) return;
      setReviews(list);
      setText(list.find((r) => r.mine)?.body ?? "");
    });
    return () => {
      cancelled = true;
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

  const send = async (method: "POST" | "DELETE") => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/reviews", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dish, body: text }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Couldn't save that. Please try again.");
    track(method === "POST" ? "review_saved" : "review_deleted", { dish });
    if (method === "DELETE") setText("");
    show(await fetchReviews());
  };

  return (
    <section className="space-y-4">
      <h3 className="text-xl font-bold">Reviews</h3>

      {reviews === null ? (
        <p className="text-sm text-zinc-500">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-zinc-500">No reviews yet. Be the first!</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li
              key={`${r.name}-${r.createdAt}`}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <p className="whitespace-pre-wrap break-words">{r.body}</p>
              <p className="mt-2 text-sm text-zinc-500">
                {r.name} · {when(r.createdAt)}
                {r.mine && " · yours"}
              </p>
            </li>
          ))}
        </ul>
      )}

      {userId ? (
        <div className="space-y-2">
          <label htmlFor="review-text" className="block text-sm font-medium">
            {mine ? "Your review" : "Write a review"}
          </label>
          <textarea
            id="review-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            rows={3}
            placeholder="What did you think?"
            className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-base dark:border-zinc-700 dark:bg-surface"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => send("POST")}
              disabled={busy || !text.trim()}
              className="rounded-lg bg-accent-fill px-4 py-2 font-semibold text-on-accent disabled:opacity-50"
            >
              {mine ? "Update review" : "Post review"}
            </button>
            {mine && (
              <button
                onClick={() => send("DELETE")}
                disabled={busy}
                className="rounded-lg px-3 py-2 font-medium text-zinc-600 hover:bg-zinc-200/60 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Delete
              </button>
            )}
            <span className="ml-auto text-xs text-zinc-500">{text.length}/{MAX}</span>
          </div>
          <p className="text-xs text-zinc-500">Shown with your first name and last initial.</p>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      ) : (
        <button
          onClick={() => void signInWithGoogle()}
          className="rounded-lg bg-accent-fill px-4 py-2 font-semibold text-on-accent"
        >
          Log in with Google to write a review
        </button>
      )}
    </section>
  );
}
