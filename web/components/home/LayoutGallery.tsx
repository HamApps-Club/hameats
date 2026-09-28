"use client";

import { HOME_LAYOUTS, type HomeLayoutId } from "@/lib/homeLayouts";

/**
 * The landing screen shown before a layout is chosen (or reopened via "Change
 * layout"): a card per registered layout, styled after a campus "Our Apps"
 * gallery page — preview thumbnail, name, description, click to open.
 */
export function LayoutGallery({
  current,
  onSelect,
}: {
  current: HomeLayoutId;
  onSelect: (id: HomeLayoutId) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-blue-600 dark:text-blue-400">Ham</span> Eats
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">Choose how you&apos;d like to browse the dining halls.</p>
      </header>

      <div className="mb-4 flex items-center gap-3">
        <span className="size-2.5 rounded-full bg-blue-600" aria-hidden />
        <h2 className="text-lg font-semibold">Home Layouts</h2>
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(HOME_LAYOUTS).map(([id, layout]) => {
          const selected = id === current;
          return (
            <button
              key={id}
              onClick={() => onSelect(id as HomeLayoutId)}
              aria-pressed={selected}
              className={`flex items-start gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm transition active:scale-[0.99] dark:bg-zinc-900 ${
                selected
                  ? "border-blue-500 ring-1 ring-blue-500"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              }`}
            >
              <layout.Preview />
              <div className="min-w-0">
                <h3 className="font-semibold text-blue-600 dark:text-blue-400">{layout.label}</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{layout.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
