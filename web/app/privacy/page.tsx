import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What information HamEats collects and how it is used.",
  alternates: { canonical: "/privacy" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-zinc-900 dark:text-zinc-100">
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-6 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        <Link href="/" className="inline-block font-medium text-blue-600 hover:underline dark:text-blue-400">
          ← Home
        </Link>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Privacy Policy</h1>
          <p className="text-sm italic">Last updated: October 25, 2026</p>
        </div>

        <p>
          HamEats (&quot;the app,&quot; &quot;the site&quot;) shows Hamilton College dining hall menus and hours. It&apos;s
          an independent student project run by Brandon Taylor &apos;28 and isn&apos;t affiliated with or endorsed by
          Hamilton College. This page explains what information HamEats collects and what it does with it.
        </p>
        <p>
          HamEats only shows the names of the dishes being served. It does not show allergen, ingredient, or
          nutritional information. If you have an allergy or dietary restriction, please ask the dining hall staff.
        </p>
        <p>
          <strong className="text-zinc-900 dark:text-zinc-100">The short version:</strong> HamEats has no accounts and
          doesn&apos;t ask for your name, email, or any personal details. It does collect anonymous usage statistics so
          I can improve the app.
        </p>

        <Section title="What I collect">
          <p>
            <strong className="text-zinc-900 dark:text-zinc-100">Usage analytics.</strong> I use PostHog, an analytics
            service, to understand how the app is used. When you visit, it records things like:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Which pages you view and when you leave them</li>
            <li>
              Actions you take in the app, such as opening a food item, choosing a dining hall or day, switching
              layouts, or toggling dark mode
            </li>
            <li>
              Your device and browser type, screen size, and approximate location (such as city or region) based on
              your IP address
            </li>
          </ul>
          <p>
            PostHog also stores a random identifier in your browser to tell visitors apart. It isn&apos;t linked to your
            name or any account. Analytics requests are routed through hameats.app itself.
          </p>
          <p>
            <strong className="text-zinc-900 dark:text-zinc-100">Information you send me.</strong> If you use the
            Feedback or &quot;Report menu&quot; forms (which open in Google Forms), or email me, I receive whatever you
            choose to submit, plus anything Google collects under its own privacy policy.
          </p>
          <p>
            <strong className="text-zinc-900 dark:text-zinc-100">Hosting data.</strong> HamEats is hosted on Vercel,
            which, like most hosts, processes technical data such as IP addresses and request logs to deliver the site
            and keep it secure.
          </p>
        </Section>

        <Section title="Information stored on your device">
          <p>
            HamEats saves your light or dark mode choice in your browser&apos;s local storage so the app remembers it.
            This stays on your device. You can clear it anytime through your browser settings.
          </p>
        </Section>

        <Section title="How I use it">
          <p>
            I use this information only to run and improve HamEats: fixing bugs, seeing which features students
            actually use, and keeping the site working. I don&apos;t sell your information, and I don&apos;t use it for
            advertising.
          </p>
        </Section>

        <Section title="Who I share it with">
          <p>
            Only the services that run HamEats: PostHog (analytics), Vercel (hosting), and Google (feedback forms).
            They process data on my behalf under their own privacy policies. I don&apos;t share it with anyone else,
            except if the law requires it.
          </p>
        </Section>

        <Section title="How long I keep it">
          <p>
            Analytics data is kept for as long as it&apos;s useful for improving the app and is used in aggregate.
            Feedback submissions are kept as long as they&apos;re useful for improving the app. You can ask me to
            delete anything you&apos;ve sent me.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-1 pl-6">
            <li>Block analytics by using a tracking blocker, or by clearing your browser data.</li>
            <li>Ask me to delete feedback you&apos;ve submitted.</li>
            <li>Ask me any question about this policy.</li>
          </ul>
        </Section>

        <Section title="Children">
          <p>
            HamEats is intended for the Hamilton College community and isn&apos;t directed at children under 13.
          </p>
        </Section>

        <Section title="Changes">
          <p>If I change this policy, I&apos;ll update the date at the top.</p>
        </Section>

        <Section title="Contact">
          <p>
            Brandon Taylor,{" "}
            <a
              href="mailto:bntaylor@hamilton.edu"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              bntaylor@hamilton.edu
            </a>
          </p>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
