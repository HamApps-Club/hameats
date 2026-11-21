import { HALLS, HALL_SHORT, type Hall } from "./halls";
import { addDays, clock, compactRange, dayHours, dowOf, type CampusTime, type Period } from "./hours";
import { SPECIALS } from "./specials";
import { MEALS, type Meal, type MenuData, type MenuItem } from "./types";
import { sameDish } from "./favorites";

// What the Favorites and Updates tabs show, worked out from the menus and the hours file. Nothing here needs an
// account or the database.

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Today", "Tomorrow", "Thursday" within the week, else "Thu 12/3". */
export function dayLabel(iso: string, today: string) {
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  const ahead = (Date.parse(iso) - Date.parse(today)) / 86_400_000;
  if (ahead > 0 && ahead < 7) return DAY_NAMES[dowOf(iso)];
  return `${SHORT_DAYS[dowOf(iso)]} ${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}

const mealWindow = (hall: Hall, date: string, meal: Meal) => dayHours(hall.hours, date).filter((p) => p.meal === meal);

// ------------------------------------------------------------------ favorites

export type Serving = { date: string; hall: Hall; meal: Meal; station: string; item: MenuItem; hours: string | null };

/**
 * Every serving of `dish` from now on, soonest first. A meal earlier today drops off once its last window
 * (Light Lunch, Late Dinner...) has closed.
 */
export function servingsOf(dish: string, data: MenuData, now: CampusTime): Serving[] {
  const out: Serving[] = [];
  for (const date of Object.keys(data.dates).sort()) {
    if (date < now.iso) continue;
    for (const meal of MEALS) {
      for (const hall of HALLS) {
        const stations = data.dates[date]?.[hall.name]?.[meal];
        if (!stations) continue;
        const windows = mealWindow(hall, date, meal);
        // The menu source can list a menu for a meal the hall isn't serving (break closures), so the hours file decides.
        if (windows.length === 0) continue;
        if (date === now.iso && Math.max(...windows.map((w) => w.close)) <= now.minutes) continue;
        for (const [station, items] of Object.entries(stations)) {
          const item = items.find((i) => sameDish(i.name, dish));
          if (item) {
            out.push({ date, hall, meal, station, item, hours: windows[0] ? compactRange(windows[0].open, windows[0].close) : null });
            break;
          }
        }
      }
    }
  }
  return out;
}

/** Every dish on the menus from today on, one entry per name, alphabetical: what the Favorites search looks through. */
export function weekDishes(data: MenuData, now: CampusTime): MenuItem[] {
  const seen = new Map<string, MenuItem>();
  for (const [date, day] of Object.entries(data.dates)) {
    if (date < now.iso) continue;
    for (const hall of Object.values(day))
      for (const stations of Object.values(hall))
        for (const items of Object.values(stations))
          for (const item of items) if (!seen.has(item.name.toLowerCase())) seen.set(item.name.toLowerCase(), item);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ------------------------------------------------------------------ updates

export type Update = {
  /** Stable key for React. */
  id: string;
  kind: "closed" | "hours" | "special";
  title: string;
  /** One line per run of days, e.g. "Saturday – Sunday: Brunch 11 AM–2 PM · Dinner 5–7 PM". */
  lines: string[];
  /** The first day it applies to, for ordering. */
  date: string;
};

const sameHours = (a: Period[], b: Period[]) =>
  a.length === b.length && a.every((x, i) => x.open === b[i].open && x.close === b[i].close && x.meal === b[i].meal);

/** "Brunch 11 AM–2 PM · Dinner 5–7 PM" */
const hoursText = (day: Period[]) => day.map((p) => `${p.name} ${compactRange(p.open, p.close)}`).join(" · ");

/** "Today", "Saturday – Friday", "Thursday 11/26": a run of days as one phrase. */
function spanLabel(from: string, to: string, today: string) {
  return from === to ? dayLabel(from, today) : `${dayLabel(from, today)} – ${dayLabel(to, today)}`;
}

/**
 * Heads-ups for the next `days` days: halls closed on a day they'd normally be open, days with different hours than
 * usual (breaks, holidays), and specials. Each run of days with the same change becomes one update, so a week-long
 * break closure is one line.
 */
export function upcomingUpdates(now: CampusTime, days = 7): Update[] {
  const updates: Update[] = [];
  const last = addDays(now.iso, days - 1);
  // Looked at past the window too, so a closure that starts this week but runs longer says when it really ends.
  const dates = Array.from({ length: days + 21 }, (_, i) => addDays(now.iso, i));

  for (const hall of HALLS) {
    const name = hall.slug === "little-pub" ? "Little Pub" : HALL_SHORT[hall.slug];
    // Days where the hours file says something different from the usual week.
    const changes = dates.map((date) => {
      const special = hall.hours.overrides?.[date];
      const usual = hall.hours[dowOf(date)];
      if (!special || sameHours(special, usual)) return null;
      return special.length === 0 ? (usual.length === 0 ? null : "closed") : hoursText(special);
    });
    // A hall's special-hours days all go on one card, a line per run of days, so a break schedule reads as one update.
    let hours: Update | null = null;
    for (let i = 0; i < dates.length && dates[i] <= last; i++) {
      const change = changes[i];
      if (!change) continue;
      let j = i;
      while (j + 1 < dates.length && changes[j + 1] === change) j++;
      const span = spanLabel(dates[i], dates[j], now.iso);
      if (change === "closed") {
        // The first day after the closure that has any hours (the usual week, or another override).
        const reopen = dates.slice(j + 1).find((d) => dayHours(hall.hours, d).length > 0);
        const first = reopen && dayHours(hall.hours, reopen)[0];
        const back = reopen && first ? ` · reopens ${dayLabel(reopen, now.iso)} at ${clock(first.open)}` : "";
        updates.push({ id: `${hall.slug}-closed-${dates[i]}`, kind: "closed", title: `${name} is closed`, lines: [span + back], date: dates[i] });
      } else {
        if (!hours) {
          hours = { id: `${hall.slug}-hours-${dates[i]}`, kind: "hours", title: `${name} has special hours`, lines: [], date: dates[i] };
          updates.push(hours);
        }
        hours.lines.push(`${span}: ${change}`);
      }
      i = j;
    }
  }

  for (const s of SPECIALS) {
    if (s.date < now.iso || s.date > last) continue;
    const hall = HALLS.find((h) => h.slug === s.hall);
    if (!hall) continue;
    updates.push({
      id: `special-${s.date}-${s.hall}-${s.item.name}`,
      kind: "special",
      title: s.item.name,
      lines: [`${dayLabel(s.date, now.iso)} · ${hall.name} · ${s.meal}`],
      date: s.date,
    });
  }

  const order = { closed: 0, hours: 1, special: 2 };
  return updates.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind]);
}
