import type { StaticImageData } from "next/image";
import type { ComponentType } from "react";
import { useCallback, useSyncExternalStore } from "react";
import { ClassicHomeLayout, type HomeLayoutProps } from "@/components/home/ClassicHomeLayout";
import { CollapsibleHomeLayout } from "@/components/home/CollapsibleHomeLayout";
import { MealFirstHomeLayout } from "@/components/home/MealFirstHomeLayout";
import { NetNutritionHomeLayout } from "@/components/home/NetNutritionHomeLayout";
// Imported rather than referenced by URL, so each thumbnail gets a content-hashed URL and an updated
// screenshot shows up right away instead of after the image optimizer's cache expires.
import netNutritionMobilePreview from "@/public/layout-previews/net-nutrition-mobile.png";
import netNutritionDesktopPreview from "@/public/layout-previews/net-nutrition-desktop.png";
import classicMobilePreview from "@/public/layout-previews/classic-mobile.png";
import classicDesktopPreview from "@/public/layout-previews/classic-desktop.png";
import collapsibleMobilePreview from "@/public/layout-previews/collapsible-mobile.png";
import collapsibleDesktopPreview from "@/public/layout-previews/collapsible-desktop.png";
import mealFirstMobilePreview from "@/public/layout-previews/meal-first-mobile.png";
import mealFirstDesktopPreview from "@/public/layout-previews/meal-first-desktop.png";

export type { HomeLayoutProps };

// Extend this union as new home layouts are registered below.
export type HomeLayoutId = "classic" | "meal-first" | "net-nutrition" | "collapsible";

type HomeLayoutEntry = {
  label: string;
  description: string;
  Component: ComponentType<HomeLayoutProps>;
  /** Static screenshots of the layout's home screen, shown as a card thumbnail in the gallery. */
  previewSrc: { mobile: StaticImageData; desktop: StaticImageData };
  /** Kept registered but left out of the gallery and not restored from storage. */
  hidden?: boolean;
};

export const HOME_LAYOUTS: Record<HomeLayoutId, HomeLayoutEntry> = {
  // Listed in gallery order.
  "net-nutrition": {
    label: "Continental",
    description: "Scroll through today's menus with ease. Dietary-restriction friendly, with allergy and diet filters, plus an Icons button to show each item's diet and allergen icons.",
    Component: NetNutritionHomeLayout,
    previewSrc: { mobile: netNutritionMobilePreview, desktop: netNutritionDesktopPreview },
  },
  classic: {
    label: "Classic",
    description: "Every dining hall as a card with today's hours and whether it's open now. Tap a hall to see its full menu.",
    Component: ClassicHomeLayout,
    previewSrc: { mobile: classicMobilePreview, desktop: classicDesktopPreview },
  },
  collapsible: {
    label: "Collapsible",
    description: "Every dining hall as a card with its hours and whether it's open now. Tap a hall to open today's menu right in the card, with allergy and diet filters.",
    Component: CollapsibleHomeLayout,
    previewSrc: { mobile: collapsibleMobilePreview, desktop: collapsibleDesktopPreview },
    hidden: true,
  },
  "meal-first": {
    label: "Comparison",
    description: "Pick a day and Breakfast, Lunch, or Dinner, then browse the halls two side by side. You can tap any food item for more details.",
    Component: MealFirstHomeLayout,
    previewSrc: { mobile: mealFirstMobilePreview, desktop: mealFirstDesktopPreview },
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
