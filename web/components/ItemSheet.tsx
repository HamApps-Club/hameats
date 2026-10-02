"use client";

import { useEffect } from "react";
import type { MenuItem, Nutrition } from "@/lib/types";
import { TagPills } from "./Tags";

// FDA daily values (2,000-calorie diet) for the % column.
type Row = { key: keyof Nutrition; label: string; unit: string; dv?: number; indent?: boolean };
const ROWS: Row[] = [
  { key: "fat", label: "Total Fat", unit: "g", dv: 78 },
  { key: "saturatedFat", label: "Saturated Fat", unit: "g", dv: 20, indent: true },
  { key: "transFat", label: "Trans Fat", unit: "g", indent: true },
  { key: "cholesterolMg", label: "Cholesterol", unit: "mg", dv: 300 },
  { key: "sodium", label: "Sodium", unit: "mg", dv: 2300 },
  { key: "carbs", label: "Total Carbohydrates", unit: "g", dv: 275 },
  { key: "fiber", label: "Dietary Fiber", unit: "g", dv: 28, indent: true },
  { key: "sugar", label: "Total Sugars", unit: "g", indent: true },
  { key: "addedSugar", label: "Added Sugars", unit: "g", dv: 50, indent: true },
  { key: "protein", label: "Protein", unit: "g", dv: 50 },
  { key: "vitaminDMcg", label: "Vitamin D", unit: "mcg", dv: 20 },
  { key: "calciumMg", label: "Calcium", unit: "mg", dv: 1300 },
  { key: "ironMg", label: "Iron", unit: "mg", dv: 18 },
  { key: "potassiumMg", label: "Potassium", unit: "mg", dv: 4700 },
];

const fmt = (n: number) => (n < 10 && n % 1 ? n.toFixed(1) : String(Math.round(n)));

/** Full-screen page for one food: calories, macros, nutrition facts, ingredients. */
export function ItemSheet({
  item,
  context,
  onClose,
}: {
  item: MenuItem;
  /** e.g. "Spoon & Fork · Lunch" */
  context: string;
  onClose: () => void;
}) {
  const n = item.nutrition ?? {};
  const rows = ROWS.filter((r) => n[r.key] != null);
  // Standing menus (e.g. the Diner's PDF) have no numbers at all; skip the empty nutrition layout for those.
  const hasNumbers = item.calories != null || Object.keys(n).length > 0 || !!item.serving;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Keep the menu underneath from scrolling while the sheet is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full overflow-y-auto bg-zinc-50 text-zinc-900 sm:h-auto sm:max-h-full sm:max-w-lg sm:rounded-xl dark:bg-background dark:text-zinc-100"
      >
        <div className="sticky top-0 z-10 bg-zinc-50/90 px-2 py-2 backdrop-blur dark:bg-background/90">
          <button
            onClick={onClose}
            autoFocus
            className="flex min-h-11 items-center gap-0.5 rounded-md px-2 text-base font-medium hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-6">
              <path
                fillRule="evenodd"
                d="M12.8 5.2a.75.75 0 0 1 0 1.06L9.06 10l3.74 3.74a.75.75 0 1 1-1.06 1.06L7.47 10.53a.75.75 0 0 1 0-1.06l4.27-4.27a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </button>
        </div>

        <div className="space-y-6 px-5 pb-10">
          <header className="space-y-2">
            <p className="text-sm text-zinc-500">{context}</p>
            <h2 className="text-3xl font-bold leading-tight">{item.name}</h2>
            <TagPills tags={item.tags} />
            {item.description && <p className="text-zinc-600 dark:text-zinc-400">{item.description}</p>}
          </header>

          {!hasNumbers && (
            <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Nutrition info isn&apos;t available for this item.
            </p>
          )}

          {hasNumbers && (
            <div className="text-center">
              <p className="text-6xl font-bold tabular-nums">
                {item.calories != null ? Math.round(item.calories) : "—"}
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-widest text-zinc-500">Calories</p>
            </div>
          )}

          {(n.protein != null || n.carbs != null || n.fat != null) && (
            <div className="grid grid-cols-3 divide-x divide-zinc-200 rounded-xl border border-zinc-200 bg-white text-center dark:divide-zinc-800 dark:border-zinc-800 dark:bg-surface">
              {(
                [
                  ["protein", "Protein"],
                  ["carbs", "Carbs"],
                  ["fat", "Fat"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="py-3">
                  <p className="text-xl font-semibold tabular-nums">{n[k] != null ? `${fmt(n[k]!)}g` : "—"}</p>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
                </div>
              ))}
            </div>
          )}

          {hasNumbers && (
            <section>
              <h3 className="mb-2 text-xl font-bold">Nutrition Facts</h3>
              <dl className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                {item.serving && (
                  <div className="flex justify-between py-2">
                    <dt className="font-semibold">Serving Size</dt>
                    <dd className="text-zinc-500">{item.serving}</dd>
                  </div>
                )}
                <div className="flex justify-between py-2">
                  <dt className="font-semibold">Calories</dt>
                  <dd className="font-semibold tabular-nums">
                    {item.calories != null ? `${Math.round(item.calories)} kcal` : "—"}
                  </dd>
                </div>
                {rows.map((r) => {
                  const v = n[r.key]!;
                  return (
                    <div key={r.key} className={`flex justify-between py-2 ${r.indent ? "pl-4" : ""}`}>
                      <dt>
                        <span className={r.indent ? "" : "font-semibold"}>{r.label}</span>{" "}
                        <span className="tabular-nums text-zinc-500">
                          {fmt(v)}
                          {r.unit}
                        </span>
                      </dt>
                      <dd className="tabular-nums text-zinc-500">{r.dv ? `${Math.round((v / r.dv) * 100)}%` : ""}</dd>
                    </div>
                  );
                })}
              </dl>
              {rows.length > 0 ? (
                <p className="mt-2 text-xs text-zinc-500">% Daily Value is based on a 2,000-calorie diet.</p>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">Detailed nutrition hasn&apos;t been posted for this item.</p>
              )}
            </section>
          )}

          {item.ingredients && (
            <section>
              <h3 className="mb-2 text-xl font-bold">Ingredients</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{item.ingredients}</p>
            </section>
          )}

          <p className="text-xs text-zinc-500">Always confirm allergens with dining staff.</p>
        </div>
      </div>
    </div>
  );
}
