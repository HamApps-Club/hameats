import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { LOGIN_DOMAIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Couldn't log in",
  robots: { index: false },
};

export default function LoginErrorPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-zinc-900 dark:text-zinc-100">
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        <Link href="/" className="inline-block font-medium text-blue-600 hover:underline dark:text-blue-400">
          ← Home
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Couldn&apos;t log in</h1>
        <p>
          Logging in to HamEats is only for Hamilton students and staff. Please try again with your{" "}
          <strong className="text-zinc-900 dark:text-zinc-100">@{LOGIN_DOMAIN}</strong> Google account.
        </p>
        <p>You can still see every menu and the dining hours without logging in.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
