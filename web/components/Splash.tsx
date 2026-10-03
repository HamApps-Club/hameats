/**
 * The launch screen: the bowl mark and the HamEats wordmark, centered on the page background, with the steam
 * rising while the site loads. It shows on every full page load, in the home-screen app (PWA) and when a link
 * is opened in a browser.
 *
 * It's in the server-rendered HTML so it covers the first paint, and plain inline scripts (no React) show and
 * hide it: SPLASH_SCRIPT in <head> adds the `splash` class to <html> before anything paints, and once the
 * menus are up (the loading message, data-menu-loading in app/page.tsx, is gone) it fades out. It's hidden
 * with classes rather than removed, so React's copy of the page never changes under it.
 */
export function Splash() {
  return (
    <div id="splash" aria-hidden>
      <svg viewBox="0 0 48 48" className="size-24">
        {/* The same mark and colors as SiteTitle and the app icon. */}
        <rect width="48" height="48" rx="12" fill="#002F86" />
        <path d="M10 24H38A14 14 0 0 1 10 24Z" fill="#FFFFFF" />
        <path d="M20.1 26h1.8a.6.6 0 0 1 .6.6v2.15h3v-2.15a.6.6 0 0 1 .6-.6h1.8a.6.6 0 0 1 .6.6v6.8a.6.6 0 0 1-.6.6h-1.8a.6.6 0 0 1-.6-.6v-2.15h-3v2.15a.6.6 0 0 1-.6.6h-1.8a.6.6 0 0 1-.6-.6v-6.8a.6.6 0 0 1 .6-.6Z" fill="#F0B100" />
        <g fill="none" strokeWidth={3} strokeLinecap="round" stroke="#F0B100">
          <path className="splash-steam" d="M18 19c-2-2.5 2-4.5 0-8" />
          <path className="splash-steam" d="M24 19c-2-2.5 2-4.5 0-8" />
          <path className="splash-steam" d="M30 19c-2-2.5 2-4.5 0-8" />
        </g>
      </svg>
      <span className="text-3xl font-bold tracking-tight">
        <span className="text-accent">Ham</span>Eats
      </span>
    </div>
  );
}

/** How long the splash stays up at the least (so it doesn't just flash) and at the most (it never hides a
 *  slow load; the stuck-loading bar takes over from there). */
const MIN_MS = 800;
const MAX_MS = 5000;
const FADE_MS = 300;

export const SPLASH_SCRIPT = `(() => {
  const root = document.documentElement;
  root.classList.add("splash");
  const start = Date.now();
  const timer = setInterval(() => {
    const waited = Date.now() - start;
    if (waited < ${MIN_MS}) return;
    const ready = document.readyState !== "loading" && !document.querySelector("[data-menu-loading]");
    if (!ready && waited < ${MAX_MS}) return;
    clearInterval(timer);
    root.classList.add("splash-out");
    setTimeout(() => root.classList.remove("splash", "splash-out"), ${FADE_MS});
  }, 100);
})();`;
