"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HALLS, orderedStations, type Hall } from "@/lib/halls";
import { compactRange, dowOf, mealNow, statusAt, type CampusTime } from "@/lib/hours";
import type { HomeLayoutProps } from "@/lib/homeLayouts";
import { type Meal, type MenuItem } from "@/lib/types";
import { ItemSheet } from "@/components/ItemSheet";
import { MealHeader, MealTabsBar } from "@/components/home/MealHeader";
import { Tags } from "@/components/Tags";
import { track } from "@/lib/analytics";

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

type Selected = { item: MenuItem; context: string };

function useItemSheet() {
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

function mealByClock(minutes: number): Meal {
  if (minutes < 10 * 60 + 30) return "Breakfast";
  if (minutes < 16 * 60) return "Lunch";
  return "Dinner";
}

function windowFor(hall: Hall, dow: number, meal: Meal) {
  return hall.hours[dow].find((p) => p.meal === meal);
}

/** Checking an allergen hides matching items; checking a preference keeps only items matching at least one. */
function itemPasses(item: MenuItem, excludeAllergens: Set<string>, requirePreferences: Set<string>) {
  if (item.tags.some((t) => excludeAllergens.has(t))) return false;
  if (requirePreferences.size > 0 && !item.tags.some((t) => requirePreferences.has(t))) return false;
  return true;
}

type FilterGroupId = "allergies" | "preferences";

/** One option as a toggle pill; filled blue when selected. */
function FilterChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`min-h-9 rounded-full border px-3 text-sm font-medium ${
        selected
          ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
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
      className={`flex min-h-10 items-center gap-1 rounded-full border px-3 text-sm font-semibold ${
        expanded || count > 0
          ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
          : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
      } bg-white dark:bg-zinc-900`}
    >
      {label}
      {count > 0 && (
        <span className="rounded-full bg-blue-600 px-1.5 text-xs leading-5 text-white dark:bg-blue-500">{count}</span>
      )}
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
        className={`size-4 transition ${expanded ? "rotate-180" : ""}`}
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
 * options as a wrapped row of pills, next to the Icons toggle; tapping outside or pressing Escape closes it.
 */
function FilterBar({
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
      <div className="flex flex-wrap items-center gap-1.5">
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
        {/* Not a filter: shows or hides the diet and allergen icons beside every item. */}
        <button
          type="button"
          aria-pressed={showIcons}
          onClick={onToggleIcons}
          className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${
            showIcons
              ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
              : "border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          }`}
        >
          Icons
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="ml-1 min-h-10 px-2 text-sm font-semibold text-red-700 hover:underline dark:text-red-400"
          >
            Clear
          </button>
        )}
      </div>
      {openGroup && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-xs text-zinc-500">
            {openGroup === "allergies" ? "Hide items that contain:" : "Only show items that are:"}
          </p>
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
      className="scroll-mt-16 space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2
        id={`${sectionId(hall)}-title`}
        tabIndex={-1}
        className="-mx-2 rounded-lg px-2 py-0.5 text-lg font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-accent dark:text-zinc-100"
      >
        {hall.name}
      </h2>

      {servingNow && <p className="text-sm font-semibold text-green-700 dark:text-green-400">● Serving now</p>}

      {win ? (
        <p className="text-sm text-zinc-500">
          {meal} · {compactRange(win.open, win.close)}
        </p>
      ) : (
        <p className="text-sm text-zinc-500">
          No {meal.toLowerCase()} {isToday ? "today" : "this day"}
        </p>
      )}

      {stations.length > 0 ? (
        <div className="space-y-3 pt-1">
          {stations.map(([station, items]) => (
            <div key={station}>
              <h3 className="mb-1.5 text-sm font-bold text-zinc-800 dark:text-zinc-200">{station}</h3>
              <div className="space-y-1.5">
                {items.map((it) => (
                  <button
                    key={it.name}
                    onClick={() => onSelect({ item: it, context: `${hall.name} · ${station} · ${meal}` })}
                    className="flex w-full items-center justify-between gap-2 text-left text-sm text-zinc-700 hover:text-blue-600 hover:underline dark:text-zinc-300 dark:hover:text-blue-400"
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
          <p className="pt-1 text-sm text-zinc-400">No items match your filters</p>
        ) : (
          <p className="pt-1 text-sm text-zinc-400">No menu posted yet</p>
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
 * TigerMenus-style hall scroller, phones only (wider screens show the halls side by side): a floating
 * card with a line of dots, one per hall, named underneath. Tapping one scrolls to that hall and
 * outlines its heading; the hall on screen gets the big blue dot. It's rendered at the end of <body>
 * and sticky to the bottom of the screen, so it rides along while scrolling and, at the very end of
 * the page, comes to rest below the footer instead of covering it. In the home-screen app it rides a
 * little higher.
 */
function HallScroller({ halls }: { halls: Hall[] }) {
  const [active, setActive] = useState(halls[0]?.slug);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const cards = halls.map((h) => document.getElementById(sectionId(h))).filter((el) => el !== null);
      if (!cards.length) return;
      const vh = window.innerHeight;
      // The active hall is the last one whose card has reached the top third of the screen. At the very
      // bottom of the page the last cards can't scroll that high, so there it's the last card on screen.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = halls[0].slug;
      cards.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= (atBottom ? vh * 0.75 : vh / 3)) current = halls[i].slug;
      });
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [halls]);

  const jump = (hall: Hall) => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(sectionId(hall))?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    // Outline the hall's heading, like TigerMenus; it clears on the next tap elsewhere.
    document.getElementById(`${sectionId(hall)}-title`)?.focus({ preventScroll: true });
    track("continental_hall_jumped", { hall: hall.slug });
  };

  return createPortal(
    <nav
      aria-label="Jump to dining hall"
      // Sits a little higher in the home-screen app, clear of the home indicator's swipe area, where taps and
      // scrolling near the bottom edge lag.
      className="sticky bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] standalone:pb-[max(1.75rem,calc(env(safe-area-inset-bottom)_+_1rem))] sm:hidden"
    >
      <div className="relative grid grid-cols-4 rounded-2xl border border-zinc-200 bg-white/95 px-1 pb-2.5 pt-3 shadow-md backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
        {/* The line the dots sit on, from the first dot's center to the last's. */}
        <div aria-hidden className="absolute left-[12.5%] right-[12.5%] top-[17px] h-px bg-zinc-300 dark:bg-zinc-600" />
        {halls.map((h) => {
          const isActive = h.slug === active;
          return (
            <button
              key={h.slug}
              type="button"
              aria-current={isActive ? "location" : undefined}
              onClick={() => jump(h)}
              className="relative flex min-h-11 flex-col items-center gap-1.5"
            >
              <span className="flex size-3 items-center justify-center">
                <span
                  className={`rounded-full ${
                    isActive ? "size-3 bg-accent" : "size-1.5 bg-zinc-400 dark:bg-zinc-500"
                  }`}
                />
              </span>
              <span
                className={`text-[15px] ${
                  isActive ? "font-semibold text-accent" : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {SHORT_NAMES[h.slug] ?? h.name}
              </span>
            </button>
          );
        })}
      </div>
    </nav>,
    document.body,
  );
}

export function NetNutritionHomeLayout({ data, now }: HomeLayoutProps) {
  const [meal, setMeal] = useState<Meal>(() => mealByClock(now.minutes));
  const dates = useMemo(() => Object.keys(data.dates).sort(), [data]);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : now.iso;
  const [excludeAllergens, setExcludeAllergens] = useState<Set<string>>(new Set());
  const [requirePreferences, setRequirePreferences] = useState<Set<string>>(new Set());
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
      <MealHeader
        dates={dates}
        selected={date}
        today={now.iso}
        onSelectDate={(d) => {
          setPickedDate(d);
          track("continental_day_picked", { date: d });
        }}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mx-auto mb-5 max-w-2xl">
          <MealTabsBar meal={meal} onSelectMeal={setMeal} />
        </div>

        <div className="mb-5">
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
