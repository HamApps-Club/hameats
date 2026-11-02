import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Rules",
  description: "The HamEats community rules: what you can post in reviews, posts, photos and comments, and what happens if you don't follow them.",
  alternates: { canonical: "/rules" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      {children}
    </section>
  );
}

const strong = "text-zinc-900 dark:text-zinc-100";
const link = "font-medium text-blue-600 hover:underline dark:text-blue-400";

export default function RulesPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-zinc-900 dark:text-zinc-100">
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-6 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        <Link href="/" className={`inline-block ${link}`}>
          ← Home
        </Link>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Rules</h1>
          <p className="text-sm italic">Last updated: November 2, 2026</p>
        </div>

        <p>
          HamEats is for talking about food at Hamilton: what&apos;s good, what&apos;s not, and what&apos;s on today. These rules
          apply to everything you post: reviews, posts, photos, comments and your username. You agree to them when you log in.
        </p>

        <Section title="The rules">
          <ol className="list-decimal space-y-3 pl-6">
            <li>
              <strong className={strong}>Keep it about food and the dining halls.</strong> Menus, dishes, lines, hours, the halls
              themselves. Off-topic posts may be removed.
            </li>
            <li>
              <strong className={strong}>Be kind to people.</strong> Criticize the food, not the people. No harassment, bullying,
              threats, hate speech or slurs. Don&apos;t name, describe or post about other students or dining staff.
            </li>
            <li>
              <strong className={strong}>Only post photos of food or the dining halls.</strong> No selfies, memes or screenshots,
              and nothing sexual, violent or gory. If someone is in your photo, make sure they&apos;re okay with it. Photos go
              through an AI safety filter that holds back pictures that aren&apos;t about food.
            </li>
            <li>
              <strong className={strong}>Keep private information private.</strong> No phone numbers, addresses, IDs, schedules or
              anything else that could identify someone, including yourself.
            </li>
            <li>
              <strong className={strong}>Be honest.</strong> Review food you actually ate. Don&apos;t spam, post the same thing over
              and over, or use more than one account to vote.
            </li>
            <li>
              <strong className={strong}>Nothing illegal or dangerous.</strong> No drugs, alcohol sales, weapons or encouraging
              anyone to get hurt.
            </li>
            <li>
              <strong className={strong}>Pick a decent username.</strong> Nothing offensive, and don&apos;t pretend to be someone
              else, including Hamilton College or Bon Appétit.
            </li>
          </ol>
        </Section>

        <Section title="What happens if a post breaks the rules">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Anyone logged in can <strong className={strong}>report</strong> a post, review or comment. When several people
              report the same thing, it&apos;s hidden from everyone but the person who wrote it.
            </li>
            <li>
              A photo the AI safety filter holds back is hidden too. You&apos;ll see a note on your post saying so, and if the
              filter got it wrong, it can be put back.
            </li>
            <li>Reported posts are reviewed by moderators, who can remove them for good.</li>
            <li>
              <strong className={strong}>Moderators can see the email address of anyone who posts something inappropriate.</strong>{" "}
              Serious or repeated breaks can lose you your account, and anything threatening someone&apos;s safety may be passed
              on to the college or the police.
            </li>
          </ul>
        </Section>

        <Section title="See something wrong?">
          <p>
            Tap <strong className={strong}>Report</strong> on the post or comment. Reports are anonymous: the person you report
            never finds out who reported them. For anything urgent, email{" "}
            <a href="mailto:bntaylor@hamilton.edu" className={link}>
              bntaylor@hamilton.edu
            </a>
            . If someone is in danger, call Campus Safety at 315-859-4000 or 911.
          </p>
        </Section>

        <p>
          See also the{" "}
          <Link href="/terms" className={link}>
            Terms
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>
          .
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
