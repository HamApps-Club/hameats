"use client";

import { useEffect, useState } from "react";

export function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const t = setTimeout(() => onSearch(value), 120);
    return () => clearTimeout(t);
  }, [value, onSearch]);

  return (
    <div className="relative">
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 1 0 3.4 9.83l3.63 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.63A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
          clipRule="evenodd"
        />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setValue("")}
        placeholder='Find a food across all halls — try "burger" or "omelet"'
        aria-label="Search menu items"
        className="w-full rounded-lg border border-zinc-200 bg-white py-3 pl-10 pr-4 text-base shadow-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-surface"
      />
    </div>
  );
}
