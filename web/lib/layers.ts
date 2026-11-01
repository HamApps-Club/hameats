"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lockScroll } from "@/lib/scrollLock";

/**
 * Full-screen pages that open on top of each other (a post, then someone's profile from it). Each one adds a history
 * entry, so the phone's back gesture (or browser Back) closes the top one instead of leaving the app.
 */
export function useLayers<T>() {
  const [stack, setStack] = useState<T[]>([]);
  const depth = useRef(0);
  useEffect(() => {
    depth.current = stack.length;
  }, [stack.length]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const depth = typeof e.state?.layer === "number" ? e.state.layer : 0;
      setStack((s) => (s.length > depth ? s.slice(0, depth) : s));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // The page underneath stays put while something is open on top.
  useEffect(() => {
    if (!stack.length) return;
    return lockScroll();
  }, [stack.length]);

  const push = useCallback((layer: T) => {
    depth.current += 1;
    history.pushState({ layer: depth.current }, "");
    setStack((s) => [...s, layer]);
  }, []);

  const pop = useCallback(() => {
    if (typeof history.state?.layer === "number") history.back();
    else setStack((s) => s.slice(0, -1));
  }, []);

  return { stack, push, pop };
}
