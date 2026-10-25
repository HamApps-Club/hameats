import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "About",
  description: "Why HamEats exists and who makes it: every dining hall menu in one place.",
  alternates: { canonical: "/about" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      {children}
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-zinc-900 dark:text-zinc-100">
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-6 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        <Link href="/" className="inline-block font-medium text-blue-600 hover:underline dark:text-blue-400">
          ← Home
        </Link>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          About Ham<span className="text-gold">Eats</span>
        </h1>

        <Section title="Summary">
          <p>
            HamEats is a web app that puts every Hamilton dining hall menu in one place, so you can see what Commons,
            McEwen, the Diner and the Little Pub are serving without clicking around.
          </p>
        </Section>

        <Section title="Motivation">
          <p>
            Hi! I&apos;m Brandon Taylor &apos;28, the creator of HamEats! I got tired of the dining menu app glitching
            out, loading forever, and having to tap 10 different times to see all the available dishes. So I decided to
            build a site that pulls everything I wanted into a single convenient page.
          </p>
        </Section>

        <Section title="Design Decisions">
          <p>I built HamEats with Next.js, React, TypeScript and Tailwind CSS, hosted on Vercel.</p>
        </Section>

        <Section title="Credits">
          <p>
            Created by Brandon Taylor &apos;28. Launched September 23, 2026.
          </p>
          <p>
            HamEats is an independent student project and isn&apos;t affiliated with or endorsed by Hamilton College or
            its dining services. Check with the dining hall if you have an allergy.
          </p>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
