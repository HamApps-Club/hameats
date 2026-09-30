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
  /** Static screenshot of the layout's home screen, shown as a card thumbnail in the gallery. */
  previewSrc: string;
};

export const HOME_LAYOUTS: Record<HomeLayoutId, HomeLayoutEntry> = {
  // Listed in gallery order.
  "meal-first": {
    label: "Comparison",
    description: "Compare Commons and McEwen side by side for the same meal. Pick a day and Breakfast, Lunch, or Dinner, then tap any item for details.",
    Component: MealFirstHomeLayout,
    previewSrc: "/layout-previews/meal-first.png",
  },
  classic: {
    label: "Classic",
    description: "Every dining hall as a card with today's hours and whether it's open now. Tap a hall to see its full menu.",
    Component: ClassicHomeLayout,
    previewSrc: "/layout-previews/classic.png",
  },
  "net-nutrition": {
    label: "Continental",
    description: "Hide foods with your allergens (dairy, egg, nuts and more) or show only vegan, vegetarian, gluten-friendly or halal options, across every hall at once.",
    Component: NetNutritionHomeLayout,
    previewSrc: "/layout-previews/net-nutrition.png",
  },
};

export const DEFAULT_HOME_LAYOUT: HomeLayoutId = "classic";

const STORAGE_KEY = "home-layout";

function isHomeLayoutId(value: string | null): value is HomeLayoutId {
  return !!value && value in HOME_LAYOUTS;
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
