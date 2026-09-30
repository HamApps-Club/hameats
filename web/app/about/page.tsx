import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "About",
  description: "Why Ham Eats exists and who makes it: every dining hall menu in one place.",
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
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-6 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        <Link href="/" className="inline-block font-medium text-blue-600 hover:underline dark:text-blue-400">
          ← Home
        </Link>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          About <span className="text-accent">Ham</span> Eats
        </h1>

        <Section title="Summary">
          <p>
            Ham Eats is a web app that puts every Hamilton dining hall menu in one place, so you can see what Commons,
            McEwen, the Diner and the Little Pub are serving without clicking around. It&apos;s still a{" "}
            <strong className="text-zinc-900 dark:text-zinc-100">demo</strong>! Right now I&apos;m doing product
            research to find the layout that makes it easiest for Hamilton students to check the menus.
          </p>
        </Section>

        <Section title="Motivation">
          <p>
            Hi! I&apos;m Brandon Taylor &apos;28, the creator of Ham Eats! I got tired of the dining menu app
            glitching out, loading forever, or not loading at all, and of tapping 10 times just to see what McEwen and
            Commons were serving. So I decided to build a site that pulls everything I wanted into a single convenient
            page. The menus come straight from Nutrislice, and so far my friends and I have found they match
            what&apos;s actually being served in the dining halls!
          </p>
        </Section>

        <Section title="Product Research">
          <p>
            Ham Eats is currently testing several home page layouts. I want to find the easiest way for the campus to
            read all of the dining data (every hall, menu, allergen category and calorie count) while keeping it as
            convenient as possible. Whichever layout students use the most will end up king of the hill and become the
            Ham Eats layout!
          </p>
        </Section>

        <Section title="Design Decisions">
          <p>
            I chose to make Ham Eats a web app to make development and maintenance a lot easier, since I didn&apos;t
            need the features of a native app. (Moreover, I don&apos;t have to wait on App Store reviews: every update
            reaches everyone the moment I publish it.)
          </p>
          <p>
            Now through their phone&apos;s default web browser, anyone on iPhone or Android can add Ham Eats to their
            home screen, where it opens just like a regular app! It even works offline and shows the last menus it
            loaded.
          </p>
          <p>
            Every hall&apos;s menu is on one page to minimize the number of taps it takes to decide where to eat. Tap
            any food to see its nutrition, allergens and ingredients. Since there&apos;s no single right answer for how
            to lay all of this out, the demo lets you choose between several layouts.
          </p>
          <p>
            I built Ham Eats with Next.js, React, TypeScript and Tailwind CSS, hosted on Vercel. The server fetches the
            menus from Nutrislice ahead of time and saves a copy, so the site loads fast, and if a refresh fails it
            keeps showing the last good menus instead of spinning forever.
          </p>
        </Section>

        <Section title="Credits">
          <p>
            Created by Brandon Taylor &apos;28. Launched September 23, 2026.
          </p>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
