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
          <p className="text-sm italic">Last updated: November 2, 2026</p>
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
          <strong className="text-zinc-900 dark:text-zinc-100">The short version:</strong> You can use HamEats without
          an account, and anyone can read the menus and the Feed. Logging in is only for Hamilton students and staff, using
          your @hamilton.edu Google account. If you log in, HamEats saves your Hamilton email address, a username
          (the only name other students see), and whatever you choose to add: thumbs ups and downs, reviews, posts,
          photos, comments and votes. Posts are moderated, and moderators can see the name and email of anyone who posts
          something inappropriate. You can download your data or delete your account anytime in Settings. It also collects
          anonymous usage statistics so I can improve the app.
        </p>

        <Section title="What I collect">
          <p>
            <strong className="text-zinc-900 dark:text-zinc-100">Usage analytics (everyone).</strong> I use PostHog, an analytics
            service, to understand how the app is used. When you visit, it records things like:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Which pages you view and when you leave them</li>
            <li>
              Actions you take in the app, such as opening a dish, choosing a dining hall, day, or layout, switching
              dark mode, or tapping Log in, a thumbs up, or a thumbs down
            </li>
            <li>
              Your device and browser type, screen size, and approximate location (such as city or region) based on
              your IP address
            </li>
          </ul>
          <p>
            PostHog also stores a random identifier in your browser to tell visitors apart. It is not connected to your
            name, your email, or your Google login. Analytics requests are routed through hameats.app itself.
          </p>
          <p>
            <strong className="text-zinc-900 dark:text-zinc-100">Logging in with Google (only if you choose to).</strong> By
            logging in with your Hamilton Google account, you agree to share your name and email address with HamEats.
          </p>
          <p>
            <strong className="text-zinc-900 dark:text-zinc-100">Your username and what you post (only if you log in).</strong> You
            get a random username, like crispy_haddock_482, which you can change. Other students see your username,
            never your real name or email. Your reviews, posts, photos, comments, liked dishes, and when you joined are
            shown on your profile and in the Feed, where anyone can see them. Your disliked dishes are only shown to
            you. A review also saves which dining hall&apos;s menu you wrote it from, and the day and meal.
          </p>
          <p>
            <strong className="text-zinc-900 dark:text-zinc-100">Photos.</strong> Photos you post are shrunk and saved
            again before they&apos;re stored, which removes the hidden details your phone adds to a photo, including
            where it was taken.
          </p>
          <p>
            <strong className="text-zinc-900 dark:text-zinc-100">Moderation.</strong> Photos are checked by an AI safety filter
            that keeps out pictures that aren&apos;t about food. New posts and anything reported are sent to a private Discord
            channel, where moderators review them. Moderators can see the name and email of anyone who posts something
            inappropriate. When you report something, the person you reported never sees who reported them.
          </p>
          <p>
            <strong className="text-zinc-900 dark:text-zinc-100">Alerts (only if you turn them on).</strong> If you ask to
            be told when a dish you like is served, HamEats saves that choice and which dishes you switched off. If you
            allow push notifications, it saves the address your phone or browser gives for sending them. Email alerts
            go to your Hamilton email address.
          </p>
          <p>
            <strong className="text-zinc-900 dark:text-zinc-100">Hosting data.</strong> HamEats is hosted on Vercel,
            which, like most hosts, processes technical data such as IP addresses and request logs to deliver the site
            and keep it secure.
          </p>
        </Section>

        <Section title="What I don&apos;t collect">
          <p>
            HamEats does not collect passwords, phone numbers, home addresses, or payment information. It never sees
            your camera or photo library: when you add a photo, your phone lets you pick or take one, and only that
            photo is sent.
          </p>
        </Section>

        <Section title="Information stored on your device">
          <p>HamEats saves a few things in your browser so the app works the way you expect:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Your light or dark mode choice</li>
            <li>Your home page layout choice</li>
            <li>A copy of the most recent menus, so the app loads fast and works offline</li>
            <li>A sign-in cookie, only if you log in</li>
          </ul>
          <p>These stay on your device. You can clear them anytime through your browser settings.</p>
        </Section>

        <Section title="How I use it">
          <p>
            I use this information only to run and improve HamEats: fixing bugs, seeing which features students
            actually use, counting thumbs ups and downs, showing reviews, posts and comments, sending the alerts you ask for, and keeping
            the site working. I don&apos;t sell your
            information, and I don&apos;t use it for advertising.
          </p>
        </Section>

        <Section title="Who I share it with">
          <p>
            Only the services that run HamEats: PostHog (analytics), Vercel (hosting), Neon (the database that stores
            thumbs ups, thumbs downs, reviews, posts and comments), Vercel Blob (where photos are stored), Google
            (log in and feedback forms), Discord (the private moderation channel), and an AI safety filter that checks
            photos. They process data on my behalf under their
            own privacy policies. I don&apos;t share it with anyone else, except if the law requires it.
          </p>
        </Section>

        <Section title="How long I keep it">
          <p>
            Analytics data is kept for as long as it&apos;s useful for improving the app and is used in aggregate.
            Thumbs ups, thumbs downs, reviews, posts, photos and comments are kept until you take them back or delete
            them. Deleting a post also deletes its photo and its comments. HamEats keeps a record of each thumbs up or
            down (not shown to anyone) so it can count the most popular dishes over time. Feedback submissions are kept as
            long as they&apos;re useful for improving the app. You can ask me to delete anything you&apos;ve sent me.
          </p>
          <p>
            Deleting your account (Settings, on your profile) deletes your username, reviews, posts, photos, comments, votes,
            alert settings and push notification addresses right away. Reports you made stay, so hidden posts stay hidden, but
            they&apos;re no longer linked to you. Copies already sent to the moderation channel may remain there.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-1 pl-6">
            <li>Block analytics by using a tracking blocker, or by clearing your browser data.</li>
            <li>Log out at any time, take back a thumbs up or down, or edit or delete your own reviews, posts and comments in the app.</li>
            <li>Change your username at any time from your profile.</li>
            <li>Turn alerts and push notifications on or off in Settings, on your profile.</li>
            <li>
              Report a post, review or comment that breaks the{" "}
              <Link href="/rules" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                Rules
              </Link>
              . Anything several people report is hidden.
            </li>
            <li>Download everything HamEats keeps about you, from Settings (Download my data).</li>
            <li>Delete your account and everything you&apos;ve added, from Settings (Delete account).</li>
            <li>Ask me to delete any feedback you&apos;ve submitted.</li>
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
