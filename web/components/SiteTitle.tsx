/**
 * The home screen's title on the navy header band: the bowl mark (cream, with gold steam) beside the HamEats
 * wordmark in Zilla Slab, "Eats" in gold, over a small tagline. Centered, with equal room on both sides for
 * the Report button (top left) and the theme toggle (top right).
 */
export function SiteTitle() {
  return (
    <h1 className="flex flex-col items-center px-24 pb-2.5 pt-2 sm:px-0">
      <span className="flex items-center gap-2 font-display text-[28px] font-bold leading-none sm:text-[32px]">
        {/* Below 360px wide there's only room for the wordmark between the two corner buttons. */}
        <svg viewBox="0 0 48 48" aria-hidden className="hidden size-7 shrink-0 min-[360px]:block">
          <path d="M10 24H38A14 14 0 0 1 10 24Z" fill="currentColor" />
          <path
            d="M18 19c-2-2.5 2-4.5 0-8M24 19c-2-2.5 2-4.5 0-8M30 19c-2-2.5 2-4.5 0-8"
            fill="none"
            strokeWidth={3}
            strokeLinecap="round"
            stroke="#F0B100"
          />
        </svg>
        <span>
          Ham<span className="text-gold">Eats</span>
        </span>
      </span>
      <span className="mt-1.5 whitespace-nowrap text-[10px] font-semibold uppercase leading-none tracking-[0.2em] opacity-75">
        Clinton, N.Y. · Dining
      </span>
    </h1>
  );
}
