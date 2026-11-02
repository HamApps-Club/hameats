"use client";

import { useEffect, useState } from "react";

/**
 * The part of the screen that's actually visible: on phones the keyboard covers the bottom of the page without
 * shrinking it, so a toolbar pinned to the bottom ends up hidden behind the keyboard. The visual viewport says how much
 * is really showing, so a full-screen page can fit itself above the keyboard (like Reddit's new-post toolbar).
 */
export function useVisibleArea() {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setArea(Math.abs(vv.height - window.innerHeight) < 1 && vv.offsetTop === 0 ? null : { top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return area;
}
