"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HALLS, orderedStations, type Hall } from "@/lib/halls";
import { compactRange, dowOf, mealNow, statusAt, type CampusTime } from "@/lib/hours";
import type { HomeLayoutProps } from "@/lib/homeLayouts";
import { MEALS, type Meal, type MenuItem } from "@/lib/types";
import { daysFrom } from "@/lib/dates";
import { DayPicker } from "@/components/DayPicker";
import { ItemSheet } from "@/components/ItemSheet";
import { Tags } from "@/components/Tags";
import { track } from "@/lib/analytics";
import { SiteTitle } from "@/components/SiteTitle";

/**
 * A fourth home layout inspired by Bowdoin Dining's "Net Nutrition" tool: the
 * same meal-first, no-search, no-click-navigation browsing as Meal First
 * (web/components/home/MealFirstHomeLayout.tsx), plus a filter panel that
 * narrows every hall's menu at once by allergen and dietary preference
 * (Allergies and Preferences dropdowns in a bar above the halls).
 */

// This app's actual tag vocabulary (see components/Tags.tsx), not the reference
// screenshot's wording — that reference is from a different school's data.
const ALLERGENS = ["Dairy", "Egg", "Fish", "Shellfish", "Pork", "Soy", "Wheat", "Sesame", "Tree Nut"] as const;
const PREFERENCES = ["Vegan", "Vegetarian", "Gluten Friendly", "Halal"] as const;

// Filters stay on across visits (saved in this browser) until the visitor turns them off or taps Clear.
const SAVED_ALLERGENS_KEY = "continental-allergens";
const SAVED_PREFERENCES_KEY = "continental-preferences";

/** A saved filter set, keeping only options that still exist. */
function readSavedFilters(key: string, options: readonly string[]): Set<string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(saved) ? saved.filter((v) => options.includes(v)) : []);
  } catch {
    return new Set();
  }
}

function saveFilters(key: string, values: Set<string>) {
  try {
    if (values.size) localStorage.setItem(key, JSON.stringify([...values]));
    else localStorage.removeItem(key);
  } catch {}
}

export type Selected = { item: MenuItem; context: string };

export function useItemSheet() {
  const [selected, setSelected] = useState<Selected | null>(null);
  useEffect(() => {
    const onPop = () => setSelected(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const open = useCallback((s: Selected) => {
    history.pushState({ itemSheet: true }, "");
    setSelected(s);
    track("item_opened", { item: s.item.name, context: s.context });
  }, []);
  const close = useCallback(() => {
    if (history.state?.itemSheet) history.back();
    else setSelected(null);
  }, []);
  const sheet = selected && <ItemSheet item={selected.item} context={selected.context} onClose={close} />;
  return { open, sheet };
}

/** The main dining halls, whose full-service hours decide when a meal is over. */
const MAIN_HALLS = HALLS.filter((h) => h.slug === "commons" || h.slug === "mcewen");

/**
 * The meal to show on the home screen: the current one until its full service ends at the main dining halls,
 * then the next one, so students see what's coming up without picking it. Breakfast switches to Lunch at
 * 10 AM on weekdays (11 on weekends), Lunch to Dinner at 2 PM, ignoring the lighter "Light Lunch" style
 * windows that follow. Dinner stays selected through the night.
 */
export function mealByClock(now: CampusTime): Meal {
  for (const meal of ["Breakfast", "Lunch"] as const) {
    const ends = MAIN_HALLS.flatMap((h) => h.hours[now.dow])
      .filter((p) => p.meal === meal && !/^(Light|Late) /.test(p.name))
      .map((p) => p.close);
    if (ends.length > 0 && now.minutes < Math.max(...ends)) return meal;
  }
  return "Dinner";
}

export function windowFor(hall: Hall, dow: number, meal: Meal) {
  return hall.hours[dow].find((p) => p.meal === meal);
}

/** Checking an allergen hides matching items; checking a preference keeps only items matching at least one. */
export function itemPasses(item: MenuItem, excludeAllergens: Set<string>, requirePreferences: Set<string>) {
  if (item.tags.some((t) => excludeAllergens.has(t))) return false;
  if (requirePreferences.size > 0 && !item.tags.some((t) => requirePreferences.has(t))) return false;
  return true;
}

type FilterGroupId = "allergies" | "preferences";

/** One option as a toggle pill: outlined in blue, filled (with a check) when selected. */
function FilterChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`flex min-h-9 items-center gap-1 rounded-full border-[1.5px] border-accent px-3 text-sm font-semibold ${
        selected ? "bg-accent-fill text-on-accent" : "text-accent hover:bg-accent/10"
      }`}
    >
      {selected && <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-3.5 shrink-0"><path d="M4 10.5l4 4 8-9" /></svg>}
      {label}
    </button>
  );
}

/** A dropdown trigger showing how many of its options are on. */
function FilterToggle({
  label,
  count,
  expanded,
  onClick,
}: {
  label: string;
  count: number;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onClick}
      // Quiet chips rather than filled pills: filters are set once, so they shouldn't outshout the menu.
      className="flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-rule bg-surface px-3 text-sm font-semibold shadow-sm shadow-black/5"
    >
      {label}
      {count > 0 && (
        <span className="rounded-full bg-accent-fill px-1.5 text-xs leading-5 text-on-accent">{count}</span>
      )}
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
        className={`size-4 text-accent transition ${expanded ? "rotate-180" : ""}`}
      >
        <path
          fillRule="evenodd"
          d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

/**
 * A compact row of dropdowns (Allergies, Preferences) above the halls. Opening one drops down its
 * options as a wrapped row of pills, next to the Labels toggle; tapping outside or pressing Escape closes it.
 */
export function FilterBar({
  excludeAllergens,
  requirePreferences,
  onToggleAllergen,
  onTogglePreference,
  onClear,
  showIcons,
  onToggleIcons,
}: {
  excludeAllergens: Set<string>;
  requirePreferences: Set<string>;
  onToggleAllergen: (value: string) => void;
  onTogglePreference: (value: string) => void;
  onClear: () => void;
  showIcons: boolean;
  onToggleIcons: () => void;
}) {
  const [openGroup, setOpenGroup] = useState<FilterGroupId | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hasFilters = excludeAllergens.size > 0 || requirePreferences.size > 0;

  useEffect(() => {
    if (!openGroup) return;
    const onPointer = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenGroup(null);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [openGroup]);

  const toggleGroup = (id: FilterGroupId) => setOpenGroup((cur) => (cur === id ? null : id));
  const [options, selected, onToggle] =
    openGroup === "allergies"
      ? [ALLERGENS, excludeAllergens, onToggleAllergen]
      : [PREFERENCES, requirePreferences, onTogglePreference];

  return (
    <div ref={barRef} className="space-y-3">
      <div className="flex items-center gap-1.5">
        <FilterToggle
          label="Allergies"
          count={excludeAllergens.size}
          expanded={openGroup === "allergies"}
          onClick={() => toggleGroup("allergies")}
        />
        <FilterToggle
          label="Preferences"
          count={requirePreferences.size}
          expanded={openGroup === "preferences"}
          onClick={() => toggleGroup("preferences")}
        />
        {/* Not a filter: shows or hides the diet and allergen icons beside every item. So it's styled apart:
            dashed, and pushed to the right. */}
        <button
          type="button"
          aria-pressed={showIcons}
          aria-label="Show dietary and allergen labels"
          onClick={onToggleIcons}
          className={`ml-auto flex min-h-10 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-semibold ${
            showIcons ? "border-accent text-foreground" : "border-dashed border-muted/50 text-muted"
          }`}
        >
          {showIcons && <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-3.5 shrink-0"><path d="M4 10.5l4 4 8-9" /></svg>}
          Labels
        </button>
      </div>
      {openGroup && (
        <div className="rounded-xl border border-rule bg-surface p-3 shadow-sm">
          {/* Clear lives here rather than in the chip row, so the row always fits on one line. */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted">
              {openGroup === "allergies" ? "Hide items that contain:" : "Only show items that are:"}
            </p>
            {hasFilters && (
              <button type="button" onClick={onClear} className="-my-2 min-h-9 px-1 text-sm font-semibold text-accent hover:underline">
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
              <FilterChip key={opt} label={opt} selected={selected.has(opt)} onToggle={() => onToggle(opt)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HallColumn({
  hall,
  meal,
  date,
  now,
  mealMenu,
  excludeAllergens,
  requirePreferences,
  showIcons,
  onSelect,
}: {
  hall: Hall;
  meal: Meal;
  date: string;
  now: CampusTime;
  mealMenu: Record<string, MenuItem[]> | undefined;
  excludeAllergens: Set<string>;
  requirePreferences: Set<string>;
  showIcons: boolean;
  onSelect: (s: Selected) => void;
}) {
  const isToday = date === now.iso;
  const win = windowFor(hall, dowOf(date), meal);
  const servingNow = isToday && win && mealNow(hall.hours, now) === meal && statusAt(hall.hours, now).open;
  const stations = orderedStations(mealMenu, hall.stationOrder)
    .map(([station, items]) => [station, items.filter((it) => itemPasses(it, excludeAllergens, requirePreferences))] as const)
    .filter(([, items]) => items.length > 0);
  const isFiltering = excludeAllergens.size > 0 || requirePreferences.size > 0;
  const hadItems = Object.values(mealMenu ?? {}).some((items) => items.length > 0);

  return (
    <section
      id={sectionId(hall)}
      className="scroll-mt-20 space-y-2 rounded-[10px] border border-t-4 border-rule border-t-accent bg-surface p-4 pb-2 shadow-[0_8px_20px_-14px] shadow-black/20"
    >
      <h2
        id={`${sectionId(hall)}-title`}
        tabIndex={-1}
        className="-mx-2 rounded-md px-2 py-0.5 font-display text-[26px] font-bold leading-tight outline-none"
      >
        {hall.name}
      </h2>

      <p className="flex flex-wrap items-center gap-2 text-[15px] text-muted">
        {servingNow && (
          <span className="rounded bg-gold px-2 py-1 text-[11px] font-bold uppercase leading-none tracking-[0.07em] text-zinc-950">
            Serving now
          </span>
        )}
        <span>{win ? `${meal} · ${compactRange(win.open, win.close)}` : `No ${meal.toLowerCase()} ${isToday ? "today" : "this day"}`}</span>
      </p>

      {stations.length > 0 ? (
        // Each station is labeled in spaced capitals with a hairline running out to the card's edge.
        <div>
          {stations.map(([station, items]) => (
            <div key={station} className="pb-2 pt-3">
              <h3 className="mb-2 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.16em] text-accent after:h-px after:flex-1 after:bg-rule">
                {station}
              </h3>
              <div>
                {items.map((it) => (
                  <button
                    key={it.name}
                    onClick={() => onSelect({ item: it, context: `${hall.name} · ${station} · ${meal}` })}
                    className="flex w-full items-center justify-between gap-2 py-1.5 text-left text-[16.5px] hover:text-accent hover:underline hover:underline-offset-[3px]"
                  >
                    <span>{it.name}</span>
                    {showIcons && <Tags tags={it.tags} />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        win &&
        (hadItems && isFiltering ? (
          <p className="pb-2 pt-1 text-sm italic text-muted">No items match your filters</p>
        ) : (
          <p className="pb-2 pt-1 text-sm italic text-muted">No menu posted yet</p>
        ))
      )}
    </section>
  );
}

/** Element id of a hall's card, for the scroller to jump to. (Not a #hash: those open the hall's own page.) */
const sectionId = (hall: Hall) => `continental-${hall.slug}`;

/** Short names so all four hall labels fit across a phone screen. */
const SHORT_NAMES: Record<string, string> = {
  commons: "Commons",
  mcewen: "McEwen",
  diner: "Diner",
  "little-pub": "Pub",
};

/**
 * Keeps a `position: fixed; bottom: 0` element on the bottom of the visible screen. iOS Safari places fixed
 * elements against its layout viewport, which can fall out of step with what's on screen (seen after the
 * keyboard closes): the layout viewport's bottom then sits hundreds of pixels above the screen's, and the
 * element floats mid-screen even as the page scrolls. The visual viewport still reports the real screen, so
 * whenever the element's bottom is above the visual viewport's bottom, it's moved down by the difference. It's
 * never moved up, so the keyboard or a pinch-zoom still covers it as usual.
 */
function usePinToVisualBottom(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    let shift = 0;
    let frame = 0;
    const place = () => {
      frame = 0;
      // Only the browser's fixed scroller (the home-screen app's is sticky; wider screens hide it).
      if (getComputedStyle(el).position !== "fixed" || !el.offsetHeight) return;
      // Both in layout-viewport coordinates: where the element ends without our shift, and where the screen ends.
      const ownBottom = el.getBoundingClientRect().bottom - shift;
      const gap = Math.round(vv.offsetTop + vv.height - ownBottom);
      const next = gap > 1 ? gap : 0;
      if (next === shift) return;
      shift = next;
      el.style.transform = shift ? `translateY(${shift}px)` : "";
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    // The keyboard and the toolbars animate; check again once they've settled.
    const settle = () => {
      schedule();
      setTimeout(schedule, 350);
    };
    place();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", settle);
    window.addEventListener("orientationchange", settle);
    window.addEventListener("pageshow", settle);
    window.addEventListener("focusout", settle);
    document.addEventListener("visibilitychange", settle);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", settle);
      window.removeEventListener("orientationchange", settle);
      window.removeEventListener("pageshow", settle);
      window.removeEventListener("focusout", settle);
      document.removeEventListener("visibilitychange", settle);
      el.style.transform = "";
    };
  }, [ref]);
}

/**
 * TigerMenus-style hall scroller, phones only (wider screens show the halls side by side): a floating
 * card with a line of dots, one per hall, named underneath. Tapping one scrolls to that hall and
 * moves focus to its heading (without drawing an outline); the hall on screen gets the gold dot.
 * When the halls after the tapped one are short (nothing served), the page can't scroll it all the way to
 * the top, so the tapped hall keeps the gold dot until you scroll yourself. It's rendered at the end of <body>. In the browser it's fixed to the bottom of the screen, because
 * a sticky one slides around while mobile Safari's toolbar shows and hides; a spacer of the same
 * height ends the page, so the footer still scrolls clear of it. In the home-screen app (no toolbar)
 * it's sticky instead, coming to rest below the footer at the very end of the page, and rides a
 * little higher.
 */
function HallScroller({ halls }: { halls: Hall[] }) {
  const navRef = useRef<HTMLElement>(null);
  usePinToVisualBottom(navRef);
  const [active, setActive] = useState(halls[0]?.slug);
  // The hall last tapped, which keeps the gold dot until the user scrolls on their own.
  const pinned = useRef<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (pinned.current) return;
      const cards = halls.map((h) => document.getElementById(sectionId(h))).filter((el) => el !== null);
      if (!cards.length) return;
      // The active hall is the last one whose card has reached a line just under the sticky header (where a
      // jump puts a card's top). A line lower down, like the top third, would pass a short card (a hall with
      // nothing served) on to the next hall while the short one still sits at the top of the screen.
      const line = parseFloat(getComputedStyle(cards[0]).scrollMarginTop) + 40;
      let current = halls[0].slug;
      cards.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= line) current = halls[i].slug;
      });
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // Touching, wheeling or pressing a key starts the user's own scroll, so the dot follows the page again.
    const unpin = () => {
      pinned.current = null;
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    for (const type of ["touchstart", "wheel", "keydown"]) window.addEventListener(type, unpin, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      for (const type of ["touchstart", "wheel", "keydown"]) window.removeEventListener(type, unpin);
    };
  }, [halls]);

  const jump = (hall: Hall) => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    pinned.current = hall.slug;
    setActive(hall.slug);
    const card = document.getElementById(sectionId(hall));
    card?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    // Move focus to the hall's heading so screen readers land there too; nothing is drawn around it.
    document.getElementById(`${sectionId(hall)}-title`)?.focus({ preventScroll: true });
    track("continental_hall_jumped", { hall: hall.slug });
  };

  return createPortal(
    <>
      {/* Browser only: room at the end of the page for the fixed scroller (card height + its bottom padding). */}
      <div aria-hidden className="h-[calc(max(0.75rem,env(safe-area-inset-bottom))_+_100.5px)] standalone:hidden sm:hidden" />
      <nav
        ref={navRef}
        aria-label="Jump to dining hall"
        // Raised 30px above the bottom edge in both the browser and the home-screen app,
        // where it also sits a little higher still, clear of the home indicator's swipe area (taps and scrolling
        // near the bottom edge lag there).
        className="fixed inset-x-0 bottom-0 z-30 px-3 standalone:sticky pb-[calc(max(0.75rem,env(safe-area-inset-bottom))_+_30px)] standalone:pb-[calc(max(2.75rem,calc(env(safe-area-inset-bottom)_+_2rem))_+_30px)] sm:hidden"
      >
        {/* The header's navy band, frosted, with a soft lift so it reads apart from the menu cards; the hall you're
            on is picked out in gold. Solid on Android, which drops the blur (see globals.css). */}
        <div className="relative grid grid-cols-4 rounded-xl bg-band/95 px-1 pb-2.5 pt-1 text-band-ink shadow-lg shadow-black/25 ring-1 ring-band-edge backdrop-blur-md android:bg-band dark:shadow-black/40">
          {/* The line the dots sit on, from the first dot's center to the last's. */}
          <div aria-hidden className="absolute left-[12.5%] right-[12.5%] top-[26px] h-px bg-band-ink/35" />
          {halls.map((h) => {
            const isActive = h.slug === active;
            return (
              <button
                key={h.slug}
                type="button"
                aria-current={isActive ? "location" : undefined}
                onClick={() => jump(h)}
                // Tall top padding is part of the button, so a tap near the card's top edge picks a hall
                // instead of falling through to the menu item behind it.
                className="relative flex min-h-11 flex-col items-center gap-1.5 pt-4"
              >
                <span className="flex size-3 items-center justify-center">
                  <span
                    className={`shrink-0 rounded-full ${
                      isActive ? "size-4 bg-gold ring-[6px] ring-gold/25" : "size-2.5 bg-band-ink/70"
                    }`}
                  />
                </span>
                <span
                  className={`text-[15px] font-bold ${
                    // Gold on navy in both modes (6.3:1 and 8:1).
                    isActive ? "text-gold" : "text-band-ink/85"
                  }`}
                >
                  {SHORT_NAMES[h.slug] ?? h.name}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>,
    document.body,
  );
}

export function NetNutritionHomeLayout({ data, now }: HomeLayoutProps) {
  // Follows the clock (moving on as each meal ends) until the student picks a meal themselves.
  const [pickedMeal, setMeal] = useState<Meal | null>(null);
  const meal = pickedMeal ?? mealByClock(now);
  // Today is always the first day, then the six after it (the menu data may be a day or two old).
  const dates = useMemo(() => daysFrom(now.iso), [now.iso]);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : now.iso;
  const [excludeAllergens, setExcludeAllergens] = useState(() => readSavedFilters(SAVED_ALLERGENS_KEY, ALLERGENS));
  const [requirePreferences, setRequirePreferences] = useState(() =>
    readSavedFilters(SAVED_PREFERENCES_KEY, PREFERENCES),
  );
  useEffect(() => saveFilters(SAVED_ALLERGENS_KEY, excludeAllergens), [excludeAllergens]);
  useEffect(() => saveFilters(SAVED_PREFERENCES_KEY, requirePreferences), [requirePreferences]);
  const [showIcons, setShowIcons] = useState(false);
  const { open, sheet } = useItemSheet();

  const toggleAllergen = useCallback((value: string) => {
    setExcludeAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      track("continental_allergen_toggled", { allergen: value, active: next.has(value) });
      return next;
    });
  }, []);
  const togglePreference = useCallback((value: string) => {
    setRequirePreferences((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      track("continental_preference_toggled", { preference: value, active: next.has(value) });
      return next;
    });
  }, []);
  const clearFilters = useCallback(() => {
    setExcludeAllergens(new Set());
    setRequirePreferences(new Set());
  }, []);


  const mealMenus = useMemo(
    () => Object.fromEntries(HALLS.map((h) => [h.slug, data.dates[date]?.[h.name]?.[meal]])),
    [data, date, meal],
  );

  return (
    <div>
      {/* Solid navy, so iOS copies it behind the clock and battery (see repaintStatusBar in lib/theme.ts). */}
      <header className="sticky top-0 z-10 border-b border-band-edge bg-band text-band-ink">
        <SiteTitle />
      </header>

      <main className="mx-auto max-w-6xl px-3.5 pb-6 pt-3">
        <div className="mx-auto mb-2 max-w-2xl">
          <DayPicker
            dates={dates}
            selected={date}
            today={now.iso}
            onSelect={(d) => {
              setPickedDate(d);
              track("continental_day_picked", { date: d });
            }}
          />
        </div>

        {/* Underlined meal tabs. The selected meal takes the blue accent (gold is kept for "now / you are here"). */}
        <div
          role="tablist"
          aria-label="Meal"
          className="mx-auto mb-5 flex max-w-2xl border-b border-zinc-200 dark:border-zinc-800"
        >
          {MEALS.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={m === meal}
              onClick={() => setMeal(m)}
              className={`-mb-px flex-1 border-b-2 py-2.5 text-lg font-bold ${
                m === meal ? "border-accent text-accent" : "border-transparent text-zinc-500"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="mx-auto mb-4 max-w-2xl">
          <FilterBar
            excludeAllergens={excludeAllergens}
            requirePreferences={requirePreferences}
            onToggleAllergen={toggleAllergen}
            onTogglePreference={togglePreference}
            onClear={clearFilters}
            showIcons={showIcons}
            onToggleIcons={() => {
              track("continental_icons_toggled", { active: !showIcons });
              setShowIcons(!showIcons);
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HALLS.map((h) => (
            <HallColumn
              key={h.slug}
              hall={h}
              meal={meal}
              date={date}
              now={now}
              mealMenu={mealMenus[h.slug]}
              excludeAllergens={excludeAllergens}
              requirePreferences={requirePreferences}
              showIcons={showIcons}
              onSelect={open}
            />
          ))}
        </div>
      </main>
      <HallScroller halls={HALLS} />
      {sheet}
    </div>
  );
}
