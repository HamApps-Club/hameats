"use client";

import Image from "next/image";
import { HOME_LAYOUTS, type HomeLayoutId } from "@/lib/homeLayouts";
import { FEEDBACK_FORM_URL } from "@/lib/site";

/**
 * The landing screen shown before a layout is chosen (or reopened via "Change
 * layout"): a card per registered layout, styled after a campus "Our Apps"
 * gallery page — preview thumbnail, name, description, click to open.
 */
export function LayoutGallery({ onSelect }: { onSelect: (id: HomeLayoutId) => void }) {
  const layouts = Object.entries(HOME_LAYOUTS).filter(([, layout]) => !layout.hidden);
  return (
    <div className="mx-auto max-w-3xl px-4 pb-2 pt-10">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-accent">Ham</span> Eats
        </h1>
      </header>

      <div className="mb-8 space-y-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
        <p>
          I&apos;d love to hear which one you&apos;d want to be the main layout.
        </p>
        <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" className="inline-block font-semibold underline">
          Share your feedback
        </a>
      </div>

      {/* One row, side by side: each card shrinks to fit, thumbnails keep their aspect ratio. */}
      <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: `repeat(${layouts.length}, minmax(0, 1fr))` }}>
        {layouts.map(([id, layout]) => {
          return (
            <button
              key={id}
              onClick={() => onSelect(id as HomeLayoutId)}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm transition hover:border-zinc-300 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <Image
                src={layout.previewSrc.mobile}
                alt=""
                width={390}
                height={844}
                className="aspect-[9/16] w-full border-b border-zinc-200 object-cover object-top sm:hidden dark:border-zinc-800"
              />
              <Image
                src={layout.previewSrc.desktop}
                alt=""
                width={1440}
                height={900}
                className="hidden aspect-[8/5] w-full border-b border-zinc-200 object-cover object-top sm:block dark:border-zinc-800"
              />
              <div className="min-w-0 p-3 sm:p-4">
                <h3 className="text-sm font-semibold text-blue-600 sm:text-base dark:text-blue-400">{layout.label}</h3>
                <p className="mt-1 text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">{layout.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
