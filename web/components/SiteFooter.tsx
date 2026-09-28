"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const FEEDBACK_NAME = "Brandon Taylor";
const FEEDBACK_EMAIL = "bntaylor@hamilton.edu";

/** Who to contact with feedback, shown as a small centered window over the page. */
function FeedbackDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-6 text-center text-base text-zinc-700 shadow-xl dark:bg-zinc-900 dark:text-zinc-300"
      >
        <h2 id="feedback-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Feedback
        </h2>
        <p>Questions, bugs, or ideas? Reach out:</p>
        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{FEEDBACK_NAME}</p>
          <a
            href={`mailto:${FEEDBACK_EMAIL}`}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {FEEDBACK_EMAIL}
          </a>
        </div>
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-xl bg-zinc-900 py-2.5 font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/** The footer shown at the bottom of every page. */
export function SiteFooter() {
  const [homeScreenOpen, setHomeScreenOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <footer className="mx-auto w-full max-w-2xl space-y-2 px-4 py-6 text-xs text-zinc-500">
      {/* Deliberately oversized: getting the app onto the home screen is the main thing we want people to do. */}
      <div className="py-4">
        <button
          onClick={() => setHomeScreenOpen((o) => !o)}
          aria-expanded={homeScreenOpen}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-6 text-2xl font-bold text-white shadow-md active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden className="size-9 shrink-0">
            <rect x="6" y="2" width="12" height="20" rx="2.5" />
            <path strokeLinecap="round" d="M12 8v6M9 11h6" />
          </svg>
          Add to Home Screen
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
            className={`size-7 shrink-0 transition ${homeScreenOpen ? "rotate-90" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M7.2 5.2a.75.75 0 0 1 1.06 0l4.27 4.27a.75.75 0 0 1 0 1.06l-4.27 4.27a.75.75 0 0 1-1.06-1.06L10.94 10 7.2 6.26a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        {homeScreenOpen && (
          <div className="mt-4 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 text-base text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <div>
              <p className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">iPhone (Safari)</p>
              <ol className="list-decimal space-y-1 pl-6">
                <li>Tap the three dots (•••) in the bottom-right corner.</li>
                <li>Tap &quot;View More.&quot;</li>
                <li>Tap &quot;Add to Home Screen.&quot;</li>
                <li>Tap &quot;Add.&quot;</li>
              </ol>
            </div>
            <div>
              <p className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Android (Chrome)</p>
              <ol className="list-decimal space-y-1 pl-6">
                <li>
                  Open the{" "}
                  <Link href="/" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                    homepage
                  </Link>{" "}
                  in Chrome.
                </li>
                <li>Tap the menu (three dots) in the top-right corner.</li>
                <li>Tap &quot;Add to Home screen&quot; (or &quot;Install app&quot;).</li>
                <li>Tap &quot;Add&quot; to confirm.</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex items-center justify-center gap-5 pt-1 text-sm text-zinc-700 dark:text-zinc-300">
        <Link href="/about" className="font-medium hover:underline">
          About
        </Link>
        <button onClick={() => setFeedbackOpen(true)} className="font-medium hover:underline">
          Feedback
        </button>
        <Link href="/hours" className="font-medium hover:underline">
          Dining hours
        </Link>
      </div>

      {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
    </footer>
  );
}
