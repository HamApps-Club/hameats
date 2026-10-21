/**
 * The launch screen: the bowl mark, about half the screen wide, on dark mode's navy-black background (the same
 * color as the mark's square, so the square doesn't show), with the steam rising while the site loads. It only
 * shows when a load is slow (the home-screen app (PWA) or a browser tab), never on a quick one.
 *
 * It's in the server-rendered HTML, and plain inline scripts (no React) show and
 * hide it: SPLASH_SCRIPT in <head> adds the `splash` class to <html> if the site isn't ready after half a second, and once the
 * menus are up (the loading message, data-menu-loading in app/HomeClient.tsx, is gone) it fades out. It's hidden
 * with classes rather than removed, so React's copy of the page never changes under it.
 */
export function Splash() {
  return (
    <div id="splash" aria-hidden>
      <svg viewBox="0 0 48 48" className="aspect-square w-[min(55vw,55vh)]">
        {/* The same mark as SiteTitle and the app icon, its square in the splash background color. */}
        <rect width="48" height="48" rx="12" fill="#0E1424" />
        <path d="M10 24H38A14 14 0 0 1 10 24Z" fill="#FFFFFF" />
        <path d="M20.1 26h1.8a.6.6 0 0 1 .6.6v2.15h3v-2.15a.6.6 0 0 1 .6-.6h1.8a.6.6 0 0 1 .6.6v6.8a.6.6 0 0 1-.6.6h-1.8a.6.6 0 0 1-.6-.6v-2.15h-3v2.15a.6.6 0 0 1-.6.6h-1.8a.6.6 0 0 1-.6-.6v-6.8a.6.6 0 0 1 .6-.6Z" fill="#F0B100" />
        <g fill="none" strokeWidth={3} strokeLinecap="round" stroke="#F0B100">
          <path className="splash-steam" d="M18 19c-2-2.5 2-4.5 0-8" />
          <path className="splash-steam" d="M24 19c-2-2.5 2-4.5 0-8" />
          <path className="splash-steam" d="M30 19c-2-2.5 2-4.5 0-8" />
        </g>
      </svg>
    </div>
  );
}

/** The splash only appears if the site still isn't ready after this long, so a fast load never shows it. Once
 *  up it stays until the menus are in, or at most this long (it never hides a slow load; the stuck-loading bar
 *  takes over from there). */
const SHOW_AFTER_MS = 500;
const MAX_MS = 5000;
const FADE_MS = 150;

export const SPLASH_SCRIPT = `(() => {
  const root = document.documentElement;
  const start = Date.now();
  let shown = false;
  const timer = setInterval(() => {
    const waited = Date.now() - start;
    const ready = document.readyState !== "loading" && !document.querySelector("[data-menu-loading]");
    if (!shown) {
      if (ready) return clearInterval(timer);
      if (waited < ${SHOW_AFTER_MS}) return;
      shown = true;
      root.classList.add("splash");
      return;
    }
    if (!ready && waited < ${MAX_MS}) return;
    clearInterval(timer);
    root.classList.add("splash-out");
    setTimeout(() => root.classList.remove("splash", "splash-out"), ${FADE_MS});
  }, 50);
})();`;
