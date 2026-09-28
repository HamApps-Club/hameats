import type { ComponentType } from "react";
import { useCallback, useSyncExternalStore } from "react";
import { ClassicHomeLayout, type HomeLayoutProps } from "@/components/home/ClassicHomeLayout";
import { MealFirstHomeLayout } from "@/components/home/MealFirstHomeLayout";

export type { HomeLayoutProps };

// Extend this union as new home layouts are registered below.
export type HomeLayoutId = "classic" | "meal-first";

export const HOME_LAYOUTS: Record<HomeLayoutId, { label: string; Component: ComponentType<HomeLayoutProps> }> = {
  classic: { label: "Classic", Component: ClassicHomeLayout },
  "meal-first": { label: "Meal First", Component: MealFirstHomeLayout },
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
