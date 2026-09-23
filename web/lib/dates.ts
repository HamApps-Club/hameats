export function localISODate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
