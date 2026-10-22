/**
 * The bowl mark with steam rising, shown in each dining hall's card while the menus load. It's the mark from
 * SiteTitle and the app icon without its square, so the card's own background shows behind it (the bowl is dark on
 * the light card and white on the dark one). The wrapper carries data-menu-loading, which the stuck-loading script in
 * app/layout.tsx watches for.
 */
export function LoadingMark() {
  return (
    <div data-menu-loading role="status" aria-label="Loading menus" className="flex justify-center py-6">
      <svg viewBox="8 7 32 32" className="aspect-square w-44 text-zinc-900 dark:text-white" aria-hidden>
        <path d="M10 24H38A14 14 0 0 1 10 24Z" fill="currentColor" />
        <path d="M20.1 26h1.8a.6.6 0 0 1 .6.6v2.15h3v-2.15a.6.6 0 0 1 .6-.6h1.8a.6.6 0 0 1 .6.6v6.8a.6.6 0 0 1-.6.6h-1.8a.6.6 0 0 1-.6-.6v-2.15h-3v2.15a.6.6 0 0 1-.6.6h-1.8a.6.6 0 0 1-.6-.6v-6.8a.6.6 0 0 1 .6-.6Z" fill="#F0B100" />
        <g fill="none" strokeWidth={3} strokeLinecap="round" stroke="#F0B100">
          <path className="loading-steam" d="M18 19c-2-2.5 2-4.5 0-8" />
          <path className="loading-steam" d="M24 19c-2-2.5 2-4.5 0-8" />
          <path className="loading-steam" d="M30 19c-2-2.5 2-4.5 0-8" />
        </g>
      </svg>
    </div>
  );
}
