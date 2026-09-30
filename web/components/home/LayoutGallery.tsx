"use client";

import Image from "next/image";
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
          <span className="text-accent">Ham</span> Eats
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">Choose how you&apos;d like to browse the dining halls.</p>
      </header>

      <div className="mb-8 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
        Welcome! This is a demo site where we&apos;re trying out a few different home page layouts to see what
        works best — pick whichever one feels right to you.
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="size-2.5 rounded-full bg-accent" aria-hidden />
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
              className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition active:scale-[0.99] dark:bg-zinc-900 ${
                selected
                  ? "border-accent ring-1 ring-accent"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              }`}
            >
              <div className="flex aspect-[9/16] w-full items-start justify-center border-b border-zinc-200 bg-zinc-100 sm:hidden dark:border-zinc-800 dark:bg-zinc-800">
                <Image
                  src={layout.previewSrc.mobile}
                  alt=""
                  width={390}
                  height={844}
                  className="h-full w-[80%] object-cover object-top"
                />
              </div>
              <Image
                src={layout.previewSrc.desktop}
                alt=""
                width={1440}
                height={900}
                className="hidden aspect-[8/5] w-full border-b border-zinc-200 object-cover object-top sm:block dark:border-zinc-800"
              />
              <div className="min-w-0 p-4">
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
