type Icon = { code: string; label: string; style: string; kind: "diet" | "contains" };

// Diet labels are filled; allergens ("contains …") are outlined so the two read differently at a glance.
const DIET = "text-white";
const CONTAINS = "border border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300";

const ICONS: Record<string, Icon> = {
  Vegan: { code: "VG", label: "Vegan", style: `${DIET} bg-green-700`, kind: "diet" },
  Vegetarian: { code: "V", label: "Vegetarian", style: `${DIET} bg-lime-600`, kind: "diet" },
  "Gluten Friendly": { code: "GF", label: "Gluten friendly", style: `${DIET} bg-sky-600`, kind: "diet" },
  Halal: { code: "H", label: "Halal", style: `${DIET} bg-teal-700`, kind: "diet" },
  Dairy: { code: "D", label: "Contains dairy", style: CONTAINS, kind: "contains" },
  Egg: { code: "E", label: "Contains egg", style: CONTAINS, kind: "contains" },
  Fish: { code: "F", label: "Contains fish", style: CONTAINS, kind: "contains" },
  Shellfish: { code: "SF", label: "Contains shellfish", style: CONTAINS, kind: "contains" },
  Pork: { code: "P", label: "Contains pork", style: CONTAINS, kind: "contains" },
  Soy: { code: "S", label: "Contains soy", style: CONTAINS, kind: "contains" },
  Wheat: { code: "W", label: "Contains wheat", style: CONTAINS, kind: "contains" },
  Sesame: { code: "SE", label: "Contains sesame", style: CONTAINS, kind: "contains" },
  "Tree Nut": { code: "TN", label: "Contains tree nuts", style: CONTAINS, kind: "contains" },
};

const iconFor = (tag: string): Icon =>
  ICONS[tag] ?? { code: tag.slice(0, 2).toUpperCase(), label: tag, style: CONTAINS, kind: "contains" };

/** Diet icons first, then allergens, each in a stable order. */
const ORDER = Object.keys(ICONS);
const sortTags = (tags: string[]) =>
  [...tags].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));

function Badge({ tag }: { tag: string }) {
  const icon = iconFor(tag);
  return (
    <span
      title={icon.label}
      aria-label={icon.label}
      role="img"
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[11px] font-bold leading-none ${icon.style}`}
    >
      {icon.code}
    </span>
  );
}

/** Compact dietary/allergen icons, e.g. [VG] [GF] (D) (S). */
export function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {sortTags(tags).map((t) => (
        <Badge key={t} tag={t} />
      ))}
    </span>
  );
}

/** Icons with their full names, for an item's detail view. */
export function TagList({ tags }: { tags: string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
      {sortTags(tags).map((t) => (
        <li key={t} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <Badge tag={t} />
          {iconFor(t).label}
        </li>
      ))}
    </ul>
  );
}

/** Key to every icon. */
export function IconLegend() {
  return (
    <details className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="cursor-pointer font-medium">What do the icons mean?</summary>
      <p className="mt-3 mb-2 text-xs text-zinc-500">Filled icons describe the dish; outlined icons mean it contains that allergen.</p>
      <TagList tags={ORDER} />
      <p className="mt-3 text-xs text-zinc-500">Tap any food for its nutrition facts. Always confirm allergens with dining staff.</p>
    </details>
  );
}

/** Labeled pills for the item page: diet labels filled, allergens outlined ("Contains dairy"). */
export function TagPills({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {sortTags(tags).map((t) => {
        const icon = iconFor(t);
        return (
          <li key={t} className={`rounded-md px-2 py-0.5 text-xs font-semibold ${icon.style}`}>
            {icon.label}
          </li>
        );
      })}
    </ul>
  );
}
