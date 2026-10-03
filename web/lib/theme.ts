/**
 * Light/dark theme. The `dark` class on <html> drives the styles (see app/globals.css). Until someone
 * picks a theme with the toggle, the app follows the device's light/dark setting; a pick is saved and
 * wins from then on.
 */

export const THEME_STORAGE_KEY = "theme";

/** The page background in each theme (zinc-50 / zinc-950, same as --background in globals.css), used
 *  for the browser's theme-color so the phone's status bar and title bar match the app. */
export const THEME_COLORS = { light: "#fafafa", dark: "#131316" } as const;

/** Applies a theme: the `dark` class, plus the theme-color the status bar is painted with. Both theme-color
 *  tags (light and dark, made by THEME_SCRIPT) get the picked theme's color, so the status bar follows the
 *  toggle whatever the phone's own setting is. */
export function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", dark ? THEME_COLORS.dark : THEME_COLORS.light);
  }
  repaintStatusBar();
}

/**
 * On iOS 26, Safari and home-screen apps paint the area behind the clock with the color of the bar pinned
 * to the top of the page (the sticky header, which is why it's solid rather than frosted: a blurred bar
 * has no single color to copy). WebKit only re-reads that color when the page loads or a pinned
 * (fixed or sticky) element is added or removed, not when colors change. Adding an invisible 1px fixed
 * element for a moment makes it re-read the header's new color right away.
 */
function repaintStatusBar() {
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = REPAINT_PROBE_STYLE;
  document.body.appendChild(probe);
  setTimeout(() => probe.remove(), 100);
}

/** Top-left corner, 1px: away from the middle of each edge, where WebKit looks for the pinned bar. */
const REPAINT_PROBE_STYLE = "position:fixed;top:0;left:0;width:1px;height:1px;pointer-events:none;opacity:0";

/**
 * Runs in <head> before the page paints, so there's no flash of the wrong theme. Also marks Android
 * (the `android` class, for Android-only styles in globals.css), and keeps following the device
 * setting if it changes while the app is open (until a theme has been picked).
 */
export const THEME_SCRIPT = `(() => {
  const root = document.documentElement;
  if (/Android/i.test(navigator.userAgent)) root.classList.add("android");
  const system = matchMedia("(prefers-color-scheme: dark)");
  const saved = () => {
    try { return localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); } catch { return null; }
  };
  // One theme-color tag for each phone setting (light and dark), made here rather than by React so it
  // never resets them. Both get the theme in use, so a pick made with the toggle wins over the phone's setting.
  const metas = ["light", "dark"].map((scheme) => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.media = "(prefers-color-scheme: " + scheme + ")";
    document.head.appendChild(meta);
    return meta;
  });
  const apply = () => {
    const pick = saved();
    const dark = pick ? pick === "dark" : system.matches;
    root.classList.toggle("dark", dark);
    for (const meta of metas) {
      meta.content = dark ? ${JSON.stringify(THEME_COLORS.dark)} : ${JSON.stringify(THEME_COLORS.light)};
    }
  };
  apply();
  // When the phone's own setting changes, also nudge iOS to repaint behind the clock (see repaintStatusBar).
  system.addEventListener("change", () => {
    if (saved()) return;
    apply();
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = ${JSON.stringify(REPAINT_PROBE_STYLE)};
    document.body.appendChild(probe);
    setTimeout(() => probe.remove(), 100);
  });
})();`;
