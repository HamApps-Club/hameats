"use client";

import { signOut, useSession } from "next-auth/react";
import { track } from "@/lib/analytics";
import { signInWithGoogle } from "@/lib/likes";

/** Log in with Google (or log out), in the corner of the home screen: an outlined button on the header's navy band. */
export function LoginButton() {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  return (
    <div className="fixed left-3 top-3 z-20">
      <button
        onClick={() => {
          track(signedIn ? "logout_clicked" : "login_clicked");
          if (signedIn) void signOut({ redirect: false });
          else void signInWithGoogle();
        }}
        aria-label={signedIn ? "Log out" : "Log in with Google"}
        // Same size either way, so the corner doesn't jump when the session finishes loading.
        className="flex min-h-10 min-w-[4.25rem] items-center justify-center rounded-lg border border-band-ink/30 bg-band-ink/5 px-3 text-sm font-semibold text-band-ink hover:bg-band-ink/10"
      >
        {signedIn ? "Log out" : "Log in"}
      </button>
    </div>
  );
}
