import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { LOGIN_DOMAIN } from "@/lib/site";

declare module "next-auth" {
  interface Session {
    user: { id?: string } & DefaultSession["user"];
  }
}

/**
 * Whether a Google profile is a verified account in the Hamilton Workspace. Google puts the Workspace domain in the
 * "hd" claim of a login, and only the domain's own accounts can carry it, so unlike checking the email's ending it
 * can't be got around with a look-alike address or a personal account that merely uses a hamilton.edu email.
 */
export function isHamiltonAccount(profile: { hd?: unknown; email?: unknown; email_verified?: unknown } | undefined) {
  return (
    profile?.hd === LOGIN_DOMAIN &&
    profile.email_verified === true &&
    typeof profile.email === "string" &&
    profile.email.toLowerCase().endsWith(`@${LOGIN_DOMAIN}`)
  );
}

/**
 * The id every vote and review is stored under: the person's (lowercased) email address. It has to be the email
 * because Auth.js gives each login a brand-new random user id when there is no database adapter (that id is
 * token.sub), so anything keyed on it belongs to one login rather than to a person, and logging out and back in
 * would start over with a new id.
 */
export function userIdFor(token: { email?: string | null }): string | undefined {
  return token.email?.trim().toLowerCase() || undefined;
}

/**
 * Sign-in with Google, nothing else, and only for Hamilton accounts. The session lives in a signed cookie (no
 * accounts table): the only things the database keeps about a person are their email address (as their id) and the
 * first name shown on a review.
 * Reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment.
 */
export const { handlers, auth } = NextAuth({
  // hd only makes Google offer Hamilton accounts first; the check that actually keeps others out is in signIn below.
  providers: [Google({ authorization: { params: { hd: LOGIN_DOMAIN, prompt: "select_account" } } })],
  // A failed login (for example a non-Hamilton account) lands here instead of on Auth.js's own error page.
  pages: { error: "/login-error" },
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    signIn: ({ profile }) => isHamiltonAccount(profile),
    session({ session, token }) {
      const id = userIdFor(token);
      if (id) session.user.id = id;
      return session;
    },
  },
});

/** "Brandon Taylor" -> "Brandon"; the only form of a name that is stored or shown. */
export function publicName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0]?.slice(0, 30);
  return first || "A student";
}
