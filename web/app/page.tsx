"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DayPicker } from "@/components/DayPicker";
import { HoursPanel } from "@/components/HoursPanel";
import { ItemSheet } from "@/components/ItemSheet";
import { LayoutGallery } from "@/components/home/LayoutGallery";
import { MenuList } from "@/components/MenuList";
import { SiteFooter } from "@/components/SiteFooter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatDate } from "@/lib/dates";
import { hallBySlug, type Hall } from "@/lib/halls";
import { HOME_LAYOUTS, hasChosenLayout, useHomeLayoutId } from "@/lib/homeLayouts";
import { campusNow, dowOf, mealLabel, mealNow, type CampusTime } from "@/lib/hours";
import { useMenuData } from "@/lib/menuData";
import { withSpecials } from "@/lib/specials";
import { withMirroredMenus } from "@/lib/mirroredMenus";
import { isStanding, standingMenuFor, withStandingMenus } from "@/lib/standingMenus";
import { MEALS, type DayMenu, type Meal, type MenuData, type MenuItem } from "@/lib/types";
import { track } from "@/lib/analytics";

// The selected hall lives in the URL hash (#commons) so the browser back button returns home.
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const useHash = () =>
  useSyncExternalStore(
    subscribeHash,
    () => window.location.hash.slice(1),
    () => "",
  );

function goHome(state: unknown) {
  // Drop the hash entirely rather than leaving a bare "#".
  history.pushState(state, "", window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  window.scrollTo({ top: 0 });
}

type Selected = { item: MenuItem; context: string };

/**
 * The food detail page. Opening it adds a history entry, so the phone's back
 * gesture (or browser Back) closes it instead of leaving the hall.
 */
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

/** Campus clock, ticking every minute so open/closed and the current meal stay right. */
function useCampusNow() {
  const [now, setNow] = useState(() => campusNow());
  useEffect(() => {
    const id = setInterval(() => setNow(campusNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Fallback when a hall has no more service today: go by the time of day. */
function mealByClock(minutes: number): Meal {
  if (minutes < 10 * 60 + 30) return "Breakfast";
  if (minutes < 16 * 60) return "Lunch";
  return "Dinner";
}

const hasMenu = (day: DayMenu | undefined, hall: Hall, meal: Meal) =>
  Object.keys(day?.[hall.name]?.[meal] ?? {}).length > 0;

/** Whether the hall's hours ever include this meal (Little Pub never serves breakfast). */
const servesMeal = (hall: Hall, meal: Meal) => hall.hours.some((d) => d.some((x) => x.meal === meal));

/** Meal tabs shown for a hall on a day. */
const mealTabs = (day: DayMenu | undefined, hall: Hall) =>
  hall.menuMeals ?? MEALS.filter((m) => servesMeal(hall, m) || hasMenu(day, hall, m));

/**
 * Start from `preferred`; if that meal has no menu, take the next meal that does (then earlier ones).
 * Always lands on a tab that's shown, so a hall that never serves breakfast never opens on it.
 */
function withMenu(preferred: Meal, day: DayMenu | undefined, hall: Hall): Meal {
  const tabs = mealTabs(day, hall);
  const i = MEALS.indexOf(preferred);
  const order = [...MEALS.slice(i), ...MEALS.slice(0, i).reverse()].filter((m) => tabs.includes(m));
  return order.find((m) => hasMenu(day, hall, m)) ?? order[0] ?? preferred;
}

const isPosted = (day: DayMenu | undefined) =>
  !!day && Object.values(day).some((meals) => Object.keys(meals).length > 0);

/** Small entry point back to the layout gallery, shown in the corner of the home screen. */
function ChangeLayoutButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="fixed left-3 top-3 z-20">
      <button
        onClick={onClick}
        aria-label="Change layout"
        className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white shadow-sm backdrop-blur hover:brightness-110"
      >
        {/* Shorter on phones so it clears the centered "Ham Eats" title. */}
        <span className="sm:hidden">Layouts</span>
        <span className="hidden sm:inline">Change layout</span>
      </button>
    </div>
  );
}

function HallView({
  hall,
  data,
  now,
  homeState,
}: {
  hall: Hall;
  data: MenuData;
  now: CampusTime;
  homeState: unknown;
}) {
  const dates = useMemo(() => Object.keys(data.dates).sort(), [data]);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [pickedMeal, setPickedMeal] = useState<Meal | null>(null);
  const { open, sheet } = useItemSheet();

  const today = now.iso;
  // Default to today, or the next day this hall has a menu (e.g. a hall that's closed on weekends).
  const servesOn = (d: string) => MEALS.some((m) => hasMenu(data.dates[d], hall, m));
  const defaultDate = dates.find((d) => d >= today && servesOn(d)) ?? (dates.includes(today) ? today : dates[0]);
  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : defaultDate;
  const day = date ? data.dates[date] : undefined;
  const dow = date ? dowOf(date) : now.dow;

  // Today: whatever the hall is serving now (or next). Other days: the first meal with a menu.
  const autoMeal = withMenu(
    date === today ? (mealNow(hall.hours, now) ?? mealByClock(now.minutes)) : "Breakfast",
    day,
    hall,
  );
  const meal = pickedMeal ?? autoMeal;
  const standing = standingMenuFor(hall.slug);

  useEffect(() => {
    track("hall_opened", { hall: hall.slug });
  }, [hall.slug]);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto grid max-w-2xl grid-cols-[5.5rem_1fr_5.5rem] items-center px-2 py-2">
          <button
            onClick={() => goHome(homeState)}
            aria-label="Back to all dining halls"
            className="flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-base font-medium hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-6">
              <path
                fillRule="evenodd"
                d="M12.8 5.2a.75.75 0 0 1 0 1.06L9.06 10l3.74 3.74a.75.75 0 1 1-1.06 1.06L7.47 10.53a.75.75 0 0 1 0-1.06l4.27-4.27a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            Home
          </button>
          <h1 className="truncate text-center text-lg font-bold">{hall.name}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <HoursPanel hours={hall.hours} now={now} />

        <DayPicker
          dates={dates}
          selected={date}
          today={today}
          onSelect={(d) => {
            setPickedDate(d);
            setPickedMeal(null);
          }}
          isDimmed={(d) => !isPosted(data.dates[d])}
        />

        <div role="tablist" aria-label="Meal" className="flex border-b border-zinc-200 dark:border-zinc-800">
          {mealTabs(day, hall).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={m === meal}
              onClick={() => setPickedMeal(m)}
              className={`-mb-px flex-1 border-b-2 py-2.5 text-base ${
                m === meal
                  ? "border-zinc-900 font-semibold dark:border-white"
                  : `border-transparent text-zinc-500 ${hasMenu(day, hall, m) ? "" : "opacity-50"}`
              }`}
            >
              {mealLabel(hall.hours, dow, m)}
            </button>
          ))}
        </div>

        {date && <p className="text-sm text-zinc-500">{formatDate(date)}</p>}
        {standing && isStanding(hall.slug, meal, day?.[hall.name]?.[meal]) && (
          <div className="space-y-1 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <p>{standing.note}</p>
            <p>
              From the posted menu ·{" "}
              <a
                href={standing.pdf}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-zinc-900 underline dark:text-zinc-100"
              >
                View PDF
              </a>
            </p>
          </div>
        )}
        <MenuList
          stations={day?.[hall.name]?.[meal]}
          stationOrder={hall.stationOrder}
          emptyText={`No ${mealLabel(hall.hours, dow, meal).toLowerCase()} menu posted for this day.`}
          note={
            standing && (
              <a href={standing.pdf} target="_blank" rel="noreferrer" className="underline">
                View the posted menu (PDF)
              </a>
            )
          }
          onSelect={(item, station) =>
            open({ item, context: `${hall.name} · ${station} · ${mealLabel(hall.hours, dow, meal)}` })
          }
        />
      </main>
      {sheet}
    </>
  );
}

export default function Home() {
  const { data: posted, status } = useMenuData();
  // Posted Nutrislice menus, plus standing menus (the Diner's PDF) and mirrored menus
  // (Commons' breakfast from McEwen's) wherever nothing was posted.
  const data = useMemo(() => posted && withSpecials(withMirroredMenus(withStandingMenus(posted))), [posted]);
  const hall = hallBySlug(useHash());
  const now = useCampusNow();
  const [layoutId, setLayoutId] = useHomeLayoutId();
  // Every load of "/" opens the visitor's layout (the default until they pick one); the
  // gallery only opens from the Change layout button. Our pushState calls aren't Next's
  // router, so navigating back to one of our entries reloads the page instead of a soft
  // popstate — read the entry's tag up front so that reload lands back on the gallery
  // if that's where it was.
  const [galleryOpen, setGalleryOpen] = useState(() => {
    if (typeof window === "undefined" || window.location.hash) return false;
    return (window.history.state as { view?: string } | null)?.view === "gallery";
  });
  const HomeLayout = HOME_LAYOUTS[layoutId].Component;

  useEffect(() => {
    if (data && !hall && !galleryOpen)
      track("home_layout_viewed", {
        layout: HOME_LAYOUTS[layoutId].analyticsName,
        layout_label: HOME_LAYOUTS[layoutId].label,
        // false while they're still on the default layout new visitors land on.
        chosen: hasChosenLayout(),
      });
  }, [data, hall, layoutId, galleryOpen]);

  // Tag the entry page load lands on as home, so the back button from the gallery (or
  // from a hall reached from home) returns here instead of wherever the plain history
  // stack would otherwise send the user — unless (see galleryOpen's initializer above)
  // this load is a reload triggered by navigating back to an entry tagged "gallery".
  useEffect(() => {
    if (window.location.hash) return;
    if ((history.state as { view?: string } | null)?.view !== "gallery") {
      history.replaceState({ view: "home" }, "");
    }
  }, []);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const view = (e.state as { view?: string } | null)?.view;
      if (view === "gallery") setGalleryOpen(true);
      else if (view === "home") setGalleryOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex-1">
        {/* Rendered client-side only: open/closed and the current meal depend on the viewer's clock. */}
        {!data ? (
          // data-menu-loading: watched by the stuck-loading script in app/layout.tsx.
          <p data-menu-loading className="py-20 text-center text-zinc-500">
            {status === "error" ? "Couldn't load menus." : "Loading menus…"}
          </p>
        ) : hall ? (
          <HallView
            key={hall.slug}
            hall={hall}
            data={data}
            now={now}
            homeState={{ view: galleryOpen ? "gallery" : "home" }}
          />
        ) : galleryOpen ? (
          <>
            <ThemeToggle />
            <LayoutGallery
              onSelect={(id) => {
                track("home_layout_changed", {
                  layout: HOME_LAYOUTS[id].analyticsName,
                  layout_label: HOME_LAYOUTS[id].label,
                  from_layout: HOME_LAYOUTS[layoutId].analyticsName,
                  // false when this is the first time they've picked, i.e. they're leaving the default.
                  had_chosen_before: hasChosenLayout(),
                  source: "gallery",
                });
                // After tracking, so had_chosen_before reflects the state before this pick.
                setLayoutId(id);
                history.pushState({ view: "home" }, "");
                setGalleryOpen(false);
                // Open the new layout at its top, not wherever the gallery was scrolled to.
                window.scrollTo({ top: 0 });
              }}
            />
          </>
        ) : (
          <>
            <ThemeToggle />
            <ChangeLayoutButton
              onClick={() => {
                history.pushState({ view: "gallery" }, "");
                setGalleryOpen(true);
                window.scrollTo({ top: 0 });
              }}
            />
            <HomeLayout data={data} now={now} />
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
