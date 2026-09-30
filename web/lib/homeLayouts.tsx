import type { ComponentType } from "react";
import { useCallback, useSyncExternalStore } from "react";
import { ClassicHomeLayout, type HomeLayoutProps } from "@/components/home/ClassicHomeLayout";
import { MealFirstHomeLayout } from "@/components/home/MealFirstHomeLayout";
import { NetNutritionHomeLayout } from "@/components/home/NetNutritionHomeLayout";

export type { HomeLayoutProps };

// Extend this union as new home layouts are registered below.
export type HomeLayoutId = "classic" | "meal-first" | "net-nutrition";

type HomeLayoutEntry = {
  label: string;
  description: string;
  Component: ComponentType<HomeLayoutProps>;
  /** Static screenshots of the layout's home screen, shown as a card thumbnail in the gallery. */
  previewSrc: { mobile: string; desktop: string };
  /** Kept registered but left out of the gallery and not restored from storage. */
  hidden?: boolean;
};

export const HOME_LAYOUTS: Record<HomeLayoutId, HomeLayoutEntry> = {
  // Listed in gallery order.
  "net-nutrition": {
    label: "Continental",
    description: "Scroll through today's menus with ease. Dietary-restriction friendly, with allergy and diet filters, plus an Icons button to show each item's diet and allergen icons.",
    Component: NetNutritionHomeLayout,
    previewSrc: { mobile: "/layout-previews/net-nutrition-mobile.png", desktop: "/layout-previews/net-nutrition-desktop.png" },
  },
  classic: {
    label: "Classic",
    description: "Every dining hall as a card with today's hours and whether it's open now. Tap a hall to see its full menu.",
    Component: ClassicHomeLayout,
    previewSrc: { mobile: "/layout-previews/classic-mobile.png", desktop: "/layout-previews/classic-desktop.png" },
  },
  "meal-first": {
    label: "Comparison",
    description: "Pick a day and Breakfast, Lunch, or Dinner, then browse the halls two side by side. You can tap any food item for more details.",
    Component: MealFirstHomeLayout,
    previewSrc: { mobile: "/layout-previews/meal-first-mobile.png", desktop: "/layout-previews/meal-first-desktop.png" },
    hidden: true,
  },
};

export const DEFAULT_HOME_LAYOUT: HomeLayoutId = "classic";

const STORAGE_KEY = "home-layout";

function isHomeLayoutId(value: string | null): value is HomeLayoutId {
  return !!value && value in HOME_LAYOUTS && !HOME_LAYOUTS[value as HomeLayoutId].hidden;
}

// localStorage's own "storage" event only fires in OTHER tabs/windows, so we
// dispatch this one ourselves to notify same-tab subscribers (e.g. the
// switcher and the layout renderer, which each call useHomeLayoutId()).
const LOCAL_CHANGE_EVENT = "home-layout-change";

function readStoredLayoutId(): HomeLayoutId {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isHomeLayoutId(stored) ? stored : DEFAULT_HOME_LAYOUT;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_CHANGE_EVENT, onChange);
  };
}

export function useHomeLayoutId(): [HomeLayoutId, (id: HomeLayoutId) => void] {
  const id = useSyncExternalStore(subscribe, readStoredLayoutId, () => DEFAULT_HOME_LAYOUT);

  const set = useCallback((next: HomeLayoutId) => {
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
  }, []);

  return [id, set];
}
