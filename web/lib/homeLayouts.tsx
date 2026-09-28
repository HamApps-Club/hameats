import type { ComponentType } from "react";
import { useCallback, useState } from "react";
import { ClassicHomeLayout, type HomeLayoutProps } from "@/components/home/ClassicHomeLayout";

export type { HomeLayoutProps };

// Extend this union as new home layouts are registered below.
export type HomeLayoutId = "classic";

export const HOME_LAYOUTS: Record<HomeLayoutId, { label: string; Component: ComponentType<HomeLayoutProps> }> = {
  classic: { label: "Classic", Component: ClassicHomeLayout },
};

export const DEFAULT_HOME_LAYOUT: HomeLayoutId = "classic";

const STORAGE_KEY = "home-layout";

function isHomeLayoutId(value: string | null): value is HomeLayoutId {
  return !!value && value in HOME_LAYOUTS;
}

export function useHomeLayoutId(): [HomeLayoutId, (id: HomeLayoutId) => void] {
  const [id, setId] = useState<HomeLayoutId>(() => {
    if (typeof window === "undefined") return DEFAULT_HOME_LAYOUT;
    const stored = localStorage.getItem(STORAGE_KEY);
    return isHomeLayoutId(stored) ? stored : DEFAULT_HOME_LAYOUT;
  });

  const set = useCallback((next: HomeLayoutId) => {
    setId(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return [id, set];
}
