import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

declare module "next-auth" {
  interface Session {
    user: { id?: string } & DefaultSession["user"];
  }
}

/**
 * Sign-in with Google, nothing else. The session lives in a signed cookie (no accounts table): the only thing the
 * database keeps about a person is their Google account ID, plus the first name shown on a review.
 * Reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment.
 */
export const { handlers, auth } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

/** "Brandon Taylor" -> "Brandon"; the only form of a name that is stored or shown. */
export function publicName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0]?.slice(0, 30);
  return first || "A student";
}
