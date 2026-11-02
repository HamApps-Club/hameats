"use client";

import { useEffect, useState } from "react";

/** Anything smaller than this is browser toolbars or rounding, not a keyboard. */
const KEYBOARD_MIN = 120;

/**
 * Where the on-screen keyboard is, while it's open. Phones lay the keyboard over the page without shrinking it, so a
 * bar pinned to the bottom ends up behind the keyboard. The visual viewport says how much is really showing. Null
 * while there's no keyboard (or the page is pinch-zoomed), so pages stay full screen.
 */
export function useKeyboard() {
  const [kb, setKb] = useState<{ top: number; page: number; covered: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const covered = window.innerHeight - vv.height;
      setKb(covered >= KEYBOARD_MIN && Math.abs(vv.scale - 1) < 0.01 ? { top: vv.offsetTop, page: window.innerHeight, covered } : null);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return kb;
}
