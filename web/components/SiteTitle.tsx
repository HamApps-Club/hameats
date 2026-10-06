/**
 * The home screen's title on the navy header band: the bowl mark (cream, with gold steam and a gold H) beside the HamEats
 * wordmark in Zilla Slab, "Eats" in gold. Centered, with equal room on both sides for
 * the Flag button (top left) and the theme toggle (top right).
 */
export function SiteTitle() {
  return (
    <h1 className="flex flex-col items-center px-24 py-3.5 sm:px-0">
      <span className="flex items-center gap-2 font-display text-[34px] font-bold leading-none sm:text-[38px]">
        {/* Below 360px wide there's only room for the wordmark between the two corner buttons. */}
        <svg viewBox="0 0 48 48" aria-hidden className="hidden size-9 shrink-0 min-[360px]:block">
          <path d="M10 24H38A14 14 0 0 1 10 24Z" fill="currentColor" />
          <path d="M20.1 26h1.8a.6.6 0 0 1 .6.6v2.15h3v-2.15a.6.6 0 0 1 .6-.6h1.8a.6.6 0 0 1 .6.6v6.8a.6.6 0 0 1-.6.6h-1.8a.6.6 0 0 1-.6-.6v-2.15h-3v2.15a.6.6 0 0 1-.6.6h-1.8a.6.6 0 0 1-.6-.6v-6.8a.6.6 0 0 1 .6-.6Z" fill="#F0B100" />
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
    </h1>
  );
}
