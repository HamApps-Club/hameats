/**
 * Light/dark theme. The `dark` class on <html> drives the styles (see app/globals.css). Until someone
 * picks a theme with the toggle, the app follows the device's light/dark setting; a pick is saved and
 * wins from then on.
 */

export const THEME_STORAGE_KEY = "theme";

/** The page background in each theme (zinc-50 / zinc-950, same as --background in globals.css), used
 *  for the browser's theme-color so the phone's status bar and title bar match the app. */
export const THEME_COLORS = { light: "#fafafa", dark: "#131316" } as const;

/** Applies a theme: the `dark` class, plus the theme-color the status bar is painted with. The tag is
 *  swapped for a new one rather than edited: iOS doesn't repaint the status bar when only its content
 *  changes, which left the top of the screen in the old theme's color. */
export function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  setThemeColor(dark ? THEME_COLORS.dark : THEME_COLORS.light);
}

function setThemeColor(color: string) {
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = color;
  const old = document.querySelector('meta[name="theme-color"]');
  if (old) old.replaceWith(meta);
  else document.head.appendChild(meta);
}

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
  const apply = () => {
    const pick = saved();
    const dark = pick ? pick === "dark" : system.matches;
    root.classList.toggle("dark", dark);
    // The theme-color tag is made here rather than by Next's metadata, so React never resets it. It's
    // swapped for a new one on each change, as in applyTheme, so iOS repaints the status bar.
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = dark ? ${JSON.stringify(THEME_COLORS.dark)} : ${JSON.stringify(THEME_COLORS.light)};
    const old = document.querySelector('meta[name="theme-color"]');
    if (old) old.replaceWith(meta);
    else document.head.appendChild(meta);
  };
  apply();
  system.addEventListener("change", () => { if (!saved()) apply(); });
})();`;
