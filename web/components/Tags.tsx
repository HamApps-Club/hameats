const TAG_STYLES: Record<string, string> = {
  Vegan: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Vegetarian: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
};

const NEUTRAL = "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";

export function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TAG_STYLES[t] ?? NEUTRAL}`}>
          {t}
        </span>
      ))}
    </span>
  );
}
