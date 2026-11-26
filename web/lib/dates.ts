/** Noon avoids the date shifting across time zones. */
const parse = (iso: string) => new Date(`${iso}T12:00:00`);

export function formatDate(iso: string) {
  return parse(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function shortWeekday(iso: string) {
  return parse(iso).toLocaleDateString(undefined, { weekday: "short" });
}

export function dayOfMonth(iso: string) {
  return parse(iso).getDate();
}

/** `count` consecutive days starting at `startIso` (default a week): today first, then the six days after it. */
export function daysFrom(startIso: string, count = 7) {
  const [y, m, d] = startIso.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}
