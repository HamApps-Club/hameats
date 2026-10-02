/**
 * The home screen's title: the bowl mark next to the HamEats wordmark. Centered on the screen, with equal room
 * on both sides for the Layouts button (top left) and the theme toggle (top right).
 */
export function SiteTitle() {
  return (
    <h1 className="flex items-center justify-center gap-2 px-24 py-4 text-2xl font-bold tracking-tight sm:px-0 sm:text-3xl">
      {/* Below 360px wide there's only room for the wordmark between the two corner buttons. */}
      <svg viewBox="0 0 48 48" aria-hidden className="hidden size-7 shrink-0 min-[360px]:block sm:size-8">
        <rect width="48" height="48" rx="12" className="fill-[#2448C9] dark:fill-[#7C9BFF]" />
        <path d="M10 24H38A14 14 0 0 1 10 24Z" className="fill-white dark:fill-zinc-950" />
        <path
          d="M18 19c-2-2.5 2-4.5 0-8M24 19c-2-2.5 2-4.5 0-8M30 19c-2-2.5 2-4.5 0-8"
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          className="stroke-[#E8532A] dark:stroke-[#FF7A50]"
        />
      </svg>
      <span>
        <span className="text-accent">Ham</span>Eats
      </span>
    </h1>
  );
}
