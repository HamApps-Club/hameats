/**
 * The bowl mark with steam rising, shown while the menus load (and in place of text when they can't). It's the
 * same mark as SiteTitle and the app icon. The wrapper carries data-menu-loading, which the stuck-loading script
 * in app/layout.tsx watches for.
 */
export function LoadingMark() {
  return (
    <div data-menu-loading role="status" aria-label="Loading menus" className="flex justify-center py-20">
      <svg viewBox="0 0 48 48" className="aspect-square w-24" aria-hidden>
        <rect width="48" height="48" rx="12" fill="#0E1424" />
        <path d="M10 24H38A14 14 0 0 1 10 24Z" fill="#FFFFFF" />
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
