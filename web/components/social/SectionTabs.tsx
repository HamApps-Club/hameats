"use client";

import { useMe } from "@/lib/me";
import { track } from "@/lib/analytics";

export type Section = "menu" | "feed" | "me";

/**
 * Which part of the app the address shows: #feed and #me, or a shared post (#post-123, which opens in the Feed).
 * Anything else, including no hash, is the Menu. The dining halls' own pages (#commons) are handled before this.
 */
export function sectionFor(hash: string): { section: Section; postId: number | null } {
  if (hash === "feed") return { section: "feed", postId: null };
  if (hash === "me") return { section: "me", postId: null };
  const post = hash.match(/^post-(\d{1,15})$/);
  if (post) return { section: "feed", postId: Number(post[1]) };
  return { section: "menu", postId: null };
}

/** Moves to a section, adding a history entry so the phone's back gesture returns to the last one. */
export function goToSection(section: Section) {
  const url = section === "menu" ? window.location.pathname + window.location.search : `#${section}`;
  history.pushState({ section }, "", url);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  window.scrollTo({ top: 0 });
}

const TABS: [Section, string][] = [
  ["menu", "Menu"],
  ["feed", "Feed"],
  ["me", "Me"],
];

/** Menu / Feed / Me, in the blue header band under the title. A gold dot on Feed means someone replied to or upvoted your post. */
export function SectionTabs({ active }: { active: Section }) {
  const { unread, status } = useMe();
  if (status === "off") return null;
  return (
    <div role="tablist" aria-label="Sections" className="mx-auto flex max-w-2xl">
      {TABS.map(([section, label]) => (
        <button
          key={section}
          role="tab"
          aria-selected={section === active}
          onClick={() => {
            if (section === active) return window.scrollTo({ top: 0, behavior: "smooth" });
            track("section_opened", { section });
            goToSection(section);
          }}
          className={`relative flex min-h-11 flex-1 items-center justify-center gap-1.5 text-[17px] font-bold ${
            section === active
              ? "text-band-ink after:absolute after:inset-x-[30%] after:bottom-0 after:h-[3px] after:rounded-t after:bg-gold"
              : "text-band-ink/70 hover:text-band-ink"
          }`}
        >
          {label}
          {section === "feed" && unread && active !== "feed" && <span aria-label="New activity" className="size-[7px] rounded-full bg-gold" />}
        </button>
      ))}
    </div>
  );
}
