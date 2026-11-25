"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { track } from "@/lib/analytics";
import { signInWithGoogle } from "@/lib/login";

/**
 * Log in with Google, in the corner of the home screen: an outlined button on the header's navy band. Once logged in it
 * becomes your picture (the first letter of your email); tapping it asks whether to log out, then confirms with a
 * message at the top of the screen.
 */
export function LoginButton() {
  const { status, data: session } = useSession();
  const signedIn = status === "authenticated";
  const initial = (session?.user?.email ?? "")[0]?.toUpperCase() ?? "";
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  // The question closes on Escape or a tap anywhere outside it.
  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setConfirming(false);
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setConfirming(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [confirming]);

  // "You're logged out" stays for a few seconds.
  useEffect(() => {
    if (!loggedOut) return;
    const id = setTimeout(() => setLoggedOut(false), 4000);
    return () => clearTimeout(id);
  }, [loggedOut]);

  const logOut = async () => {
    setBusy(true);
    track("logout_confirmed");
    await signOut({ redirect: false }).catch(() => {});
    setBusy(false);
    setConfirming(false);
    setLoggedOut(true);
  };

  return (
    <>
      <div ref={wrapper} className="fixed left-3 top-3 z-20">
        <button
          onClick={() => {
            if (signedIn) {
              track("logout_clicked");
              setConfirming((c) => !c);
            } else {
              track("login_clicked");
              void signInWithGoogle();
            }
          }}
          aria-label={signedIn ? "Logged in: log out" : "Log in with Google"}
          aria-expanded={signedIn ? confirming : undefined}
          className={
            signedIn
              ? "flex size-10 items-center justify-center rounded-full border-2 border-band-ink/60 bg-gold font-display text-xl font-bold text-zinc-950"
              : "flex min-h-10 min-w-[4.25rem] items-center justify-center rounded-lg border border-band-ink/30 bg-band-ink/5 px-3 text-sm font-semibold text-band-ink hover:bg-band-ink/10"
          }
        >
          {signedIn ? initial : "Log in"}
        </button>

        {confirming && (
          <div
            role="dialog"
            aria-label="Log out of HamEats"
            className="absolute left-0 top-full z-40 mt-1.5 w-64 rounded-xl border border-zinc-200 bg-white p-4 text-left text-base text-zinc-700 shadow-xl dark:border-zinc-700 dark:bg-surface dark:text-zinc-300"
          >
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">Log out of HamEats?</p>
            <p className="mt-1 text-sm">You&apos;ll need to log in again to see your favorites.</p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={logOut}
                disabled={busy}
                className="rounded-lg bg-accent-fill px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-60"
              >
                {busy ? "Logging out…" : "Log out"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {loggedOut && (
        <div
          role="status"
          className="fixed inset-x-0 top-16 z-40 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-xl bg-zinc-900 px-5 py-3 text-center text-base font-medium text-white shadow-xl dark:bg-zinc-100 dark:text-zinc-900"
        >
          You&apos;re logged out. See you next time!
        </div>
      )}
    </>
  );
}
