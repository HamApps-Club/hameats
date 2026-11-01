"use client";

/**
 * Stops the page underneath from scrolling while something covers it (a food's page, a post, a profile). Several can
 * be open at once and close in any order, so it's counted: the page scrolls again only when the last one closes.
 * (Each one saving and restoring the old setting itself left the page stuck when they closed out of order.)
 */
let locks = 0;

export function lockScroll(): () => void {
  locks += 1;
  document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) document.body.style.overflow = "";
  };
}
