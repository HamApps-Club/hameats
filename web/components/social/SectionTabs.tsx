"use client";

import { track } from "@/lib/analytics";

export type Section = "menu" | "favorites" | "updates" | "me";

/**
 * Which part of the app the address shows: #favorites, #updates, or (for people who signed in under the old social
 * features) their account page at #me or #notifications, which tapping a morning alert opens. The Feed is gone, so old
 * #feed and shared-post links (#post-123) open the Menu. Anything else, including no hash, is the Menu. The dining
 * halls' own pages (#commons) are handled before this.
 */
export function sectionFor(hash: string): { section: Section; notifications: boolean } {
  if (hash === "favorites") return { section: "favorites", notifications: false };
  if (hash === "updates") return { section: "updates", notifications: false };
  if (hash === "me") return { section: "me", notifications: false };
  if (hash === "notifications") return { section: "me", notifications: true };
  return { section: "menu", notifications: false };
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
  ["favorites", "Favorites"],
  ["updates", "Updates"],
];

/** Menu / Favorites / Updates, in the blue header band under the title. None of them needs an account. */
export function SectionTabs({ active }: { active: Section }) {
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
        </button>
      ))}
    </div>
  );
}
