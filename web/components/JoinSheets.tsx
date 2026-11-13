"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { LOGIN_REQUESTED, continueWithGoogle } from "@/lib/likes";
import { useMe } from "@/lib/me";
import { track } from "@/lib/analytics";

const link = "font-semibold text-accent underline";

/** The rules in a few lines: what the welcome screen asks people to agree to. The whole list is at /rules. */
export const RULES_SHORT = [
  "Keep it about food and the dining halls.",
  "Be kind. No harassment, hate or bullying, and don't name or post about other people.",
  "Only post photos of food or the dining halls, and nothing explicit or violent.",
  "Don't share anyone's private information, including your own.",
];

/**
 * The screen every "Log in" button opens before going to Google: what logging in shares, what's public, and links to
 * the Rules and Privacy Policy, like the "By continuing you agree to..." line under a social app's sign-up button.
 */
export function LoginSheet() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onRequest = () => {
      track("login_sheet_shown");
      setOpen(true);
    };
    window.addEventListener(LOGIN_REQUESTED, onRequest);
    return () => window.removeEventListener(LOGIN_REQUESTED, onRequest);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy]);

  if (!open) return null;

  const go = () => {
    setBusy(true);
    track("login_continue");
    void continueWithGoogle();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={() => !busy && setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-zinc-700 shadow-xl sm:rounded-2xl dark:bg-surface dark:text-zinc-300"
      >
        <h2 id="login-sheet-title" className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Log in with your Hamilton account
        </h2>
        <p className="mt-1 text-[15px]">Vote on dishes, write reviews, post photos and get alerts when food you like is served.</p>

        <ul className="mt-4 space-y-2.5 text-[15px] leading-snug">
          <li className="flex gap-2.5">
            <span aria-hidden>👤</span>
            <span>
              <strong className="text-zinc-900 dark:text-zinc-100">Other students only see your username.</strong> You get a random one, like
              crispy_haddock_482, and can change it. Never your name or email.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden>🌐</span>
            <span>
              <strong className="text-zinc-900 dark:text-zinc-100">What you post is public.</strong> Reviews, posts, photos, comments and the dishes
              you like show on your profile and in the Feed, for anyone to see.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden>🛡️</span>
            <span>
              <strong className="text-zinc-900 dark:text-zinc-100">Posts are moderated.</strong> Photos go through an AI safety filter, and
              moderators can see the email address of anyone who posts something inappropriate.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden>🗑️</span>
            <span>
              <strong className="text-zinc-900 dark:text-zinc-100">You&apos;re in control.</strong> Delete anything you post, download your data,
              or delete your account anytime in Settings.
            </span>
          </li>
        </ul>

        <button
          type="button"
          onClick={go}
          disabled={busy}
          autoFocus
          className="mt-6 min-h-12 w-full rounded-full bg-accent-fill px-5 text-base font-semibold text-on-accent disabled:opacity-60"
        >
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="mt-2 min-h-11 w-full rounded-full text-base font-medium text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Not now
        </button>
        <p className="mt-3 text-center text-[13px] leading-snug text-muted">
          Only @hamilton.edu accounts. By continuing you agree to the{" "}
          <a href="/rules" className={link}>
            Rules
          </a>
          ,{" "}
          <a href="/terms" className={link}>
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className={link}>
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

/**
 * Shown once, right after someone's first login (and once to everyone who joined before it existed): their username and
 * the rules, with "I agree" to carry on. Like the community-guidelines screen Yik Yak and Fizz show new members.
 */
export function WelcomeSheet() {
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (me.status !== "in" || me.rulesAccepted) return null;

  const agree = async () => {
    setBusy(true);
    setError("");
    try {
      await me.acceptRules();
      track("rules_accepted");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-zinc-700 shadow-xl sm:rounded-2xl dark:bg-surface dark:text-zinc-300"
      >
        <h2 id="welcome-title" className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Welcome to HamEats
        </h2>
        <p className="mt-1 text-[15px]">
          You&apos;re <strong className="text-zinc-900 dark:text-zinc-100">u/{me.username ?? "…"}</strong>. That&apos;s the only name other students
          see. You can change it anytime from your profile.
        </p>

        <h3 className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-accent">The rules</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[15px] leading-snug">
          {RULES_SHORT.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
        <p className="mt-3 text-[13px] leading-snug text-muted">
          Posts that break the rules get hidden, and moderators can see the email address of whoever posted them. Repeated
          or serious breaks can lose you your account.{" "}
          <a href="/rules" className={link}>
            Read all the rules
          </a>
        </p>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void agree()}
          disabled={busy}
          autoFocus
          className="mt-5 min-h-12 w-full rounded-full bg-accent-fill px-5 text-base font-semibold text-on-accent disabled:opacity-60"
        >
          {busy ? "Saving…" : "I agree"}
        </button>
        <button
          type="button"
          onClick={() => {
            track("rules_declined");
            void signOut({ redirect: false }).then(() => window.location.reload());
          }}
          disabled={busy}
          className="mt-2 min-h-11 w-full rounded-full text-base font-medium text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Log out instead
        </button>
      </div>
    </div>
  );
}
