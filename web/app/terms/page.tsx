import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for using HamEats, an independent student project for Hamilton College dining menus.",
  alternates: { canonical: "/terms" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      {children}
    </section>
  );
}

const link = "font-medium text-blue-600 hover:underline dark:text-blue-400";

export default function TermsPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-zinc-900 dark:text-zinc-100">
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-6 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        <Link href="/" className={`inline-block ${link}`}>
          ← Home
        </Link>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Terms</h1>
          <p className="text-sm italic">Last updated: November 2, 2026</p>
        </div>

        <p>
          By using HamEats you agree to these terms, the{" "}
          <Link href="/rules" className={link}>
            Rules
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>
          . They&apos;re short on purpose.
        </p>

        <Section title="What HamEats is">
          <p>
            HamEats is an independent student project run by Brandon Taylor &apos;28. It isn&apos;t run, endorsed or checked by
            Hamilton College or its dining service. It&apos;s free, and it may change or shut down at any time.
          </p>
        </Section>

        <Section title="Menus and food information">
          <p>
            Menus and hours come from the college&apos;s published menus and can be wrong, late or change without notice.
            HamEats doesn&apos;t show allergen or ingredient information. If you have an allergy or dietary restriction, always ask
            dining staff before you eat.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            Logging in is for current Hamilton students and staff with an @hamilton.edu Google account. Use one account, keep
            it to yourself, and follow the Rules. You can delete your account at any time in Settings. HamEats can suspend or
            remove an account that breaks the Rules.
          </p>
        </Section>

        <Section title="What you post">
          <p>
            You own what you post. By posting it, you let HamEats show it in the app and on your profile, to anyone who opens
            them, until you delete it. You&apos;re responsible for what you post, and you must have the right to post it (for
            example, a photo you took). Posts other people write are their own opinions, not HamEats&apos;.
          </p>
          <p>
            Moderators can hide or remove anything that breaks the Rules, and can see the name and email of anyone who posts
            something inappropriate.
          </p>
        </Section>

        <Section title="No guarantees">
          <p>
            HamEats is provided as is. It may be down, slow or wrong at times, and it isn&apos;t responsible for decisions made
            based on it, such as which dining hall to go to.
          </p>
        </Section>

        <Section title="Changes">
          <p>If these terms change, the date at the top is updated. Using HamEats after a change means you accept the new terms.</p>
        </Section>

        <Section title="Contact">
          <p>
            Brandon Taylor,{" "}
            <a href="mailto:bntaylor@hamilton.edu" className={link}>
              bntaylor@hamilton.edu
            </a>
          </p>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
