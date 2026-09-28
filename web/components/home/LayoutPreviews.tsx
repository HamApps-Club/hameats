/**
 * Small stylized thumbnails for the layout gallery cards — not live renders of
 * the actual layouts, just enough shape/color to tell them apart at a glance.
 */

const PREVIEW_FRAME = "h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-1.5 dark:border-zinc-700 dark:bg-zinc-800";

export function ClassicPreview() {
  return (
    <div className={PREVIEW_FRAME}>
      <div className="mb-1 h-1.5 w-8 rounded-full bg-blue-400" />
      <div className="mb-1.5 h-2 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="space-y-1">
        <div className="h-2.5 rounded bg-white shadow-sm dark:bg-zinc-900" />
        <div className="h-2.5 rounded bg-white shadow-sm dark:bg-zinc-900" />
        <div className="h-2.5 rounded bg-white shadow-sm dark:bg-zinc-900" />
      </div>
    </div>
  );
}

export function MealFirstPreview() {
  return (
    <div className={PREVIEW_FRAME}>
      <div className="mb-1.5 flex gap-0.5">
        <div className="h-1.5 flex-1 rounded-full bg-blue-400" />
        <div className="h-1.5 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-1.5 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div className="h-4 rounded bg-white shadow-sm dark:bg-zinc-900" />
        <div className="h-4 rounded bg-white shadow-sm dark:bg-zinc-900" />
        <div className="h-4 rounded bg-white shadow-sm dark:bg-zinc-900" />
        <div className="h-4 rounded bg-white shadow-sm dark:bg-zinc-900" />
      </div>
    </div>
  );
}

export function AccordionPreview() {
  return (
    <div className={PREVIEW_FRAME}>
      <div className="space-y-1">
        <div className="h-2 rounded bg-white shadow-sm dark:bg-zinc-900" />
        <div className="space-y-0.5 rounded bg-white p-1 shadow-sm dark:bg-zinc-900">
          <div className="h-1 w-3/4 rounded-full bg-blue-300 dark:bg-blue-500/60" />
          <div className="h-3 rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <div className="h-2 rounded bg-white shadow-sm dark:bg-zinc-900" />
      </div>
    </div>
  );
}
