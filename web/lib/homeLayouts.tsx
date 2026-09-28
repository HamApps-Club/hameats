import type { ComponentType } from "react";
import { useCallback, useSyncExternalStore } from "react";
import { AccordionHomeLayout } from "@/components/home/AccordionHomeLayout";
import { ClassicHomeLayout, type HomeLayoutProps } from "@/components/home/ClassicHomeLayout";
import { MealFirstHomeLayout } from "@/components/home/MealFirstHomeLayout";
import { AccordionPreview, ClassicPreview, MealFirstPreview } from "@/components/home/LayoutPreviews";

export type { HomeLayoutProps };

// Extend this union as new home layouts are registered below.
export type HomeLayoutId = "classic" | "meal-first" | "accordion";

type HomeLayoutEntry = {
  label: string;
  description: string;
  Component: ComponentType<HomeLayoutProps>;
  Preview: ComponentType;
};

export const HOME_LAYOUTS: Record<HomeLayoutId, HomeLayoutEntry> = {
  classic: {
    label: "Classic",
    description: "A search bar up top and every dining hall listed below, ranked by what's open now.",
    Component: ClassicHomeLayout,
    Preview: ClassicPreview,
  },
  "meal-first": {
    label: "Meal First",
    description: "Pick Breakfast, Lunch, or Dinner, then browse halls as cards scoped to that meal.",
    Component: MealFirstHomeLayout,
    Preview: MealFirstPreview,
  },
  accordion: {
    label: "Accordion",
    description: "Every hall on one page — tap to expand its menu in place, no navigating away.",
    Component: AccordionHomeLayout,
    Preview: AccordionPreview,
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
    localStorage.setItem(PICKED_KEY, "1");
    window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
  }, []);

  return [id, set];
}

// Separate from STORAGE_KEY so we can tell "never chosen" (show the gallery)
// apart from "explicitly chose the default layout" (don't show it again).
const PICKED_KEY = "home-layout-picked";

/** Whether the visitor has ever picked a layout — false only until their first choice. */
export function useHasPickedHomeLayout(): boolean {
  return useSyncExternalStore(subscribe, () => localStorage.getItem(PICKED_KEY) === "1", () => false);
}
