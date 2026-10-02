/**
 * The home screen's title: the bowl mark next to the HamEats wordmark. Centered on the screen, with equal room
 * on both sides for the Layouts button (top left) and the theme toggle (top right).
 */
export function SiteTitle() {
  return (
    <h1 className="flex items-center justify-center gap-2 px-24 py-4 text-2xl font-bold tracking-tight sm:px-0 sm:text-3xl">
      {/* The same colors as the app icon in light and dark mode, so the mark never changes. Below 360px wide
          there's only room for the wordmark between the two corner buttons. */}
      <svg viewBox="0 0 48 48" aria-hidden className="hidden size-7 shrink-0 min-[360px]:block sm:size-8">
        <rect width="48" height="48" rx="12" fill="#002F86" />
        <path d="M10 24H38A14 14 0 0 1 10 24Z" fill="#FFFFFF" />
        <path
          d="M18 19c-2-2.5 2-4.5 0-8M24 19c-2-2.5 2-4.5 0-8M30 19c-2-2.5 2-4.5 0-8"
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          stroke="#D6BA8B"
        />
      </svg>
      <span>
        <span className="text-accent">Ham</span>Eats
      </span>
    </h1>
  );
}
