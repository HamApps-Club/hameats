import type { Meal } from "./types";

/** Hours are published in campus time; use it no matter where the viewer is. */
const TIME_ZONE = "America/New_York";

/**
 * One service window. Times are minutes after midnight; a close past 24:00
 * (e.g. 3 a.m. = 27 * 60) means the window runs into the next day.
 */
export type Period = { name: string; meal: Meal; open: number; close: number };
/** Index 0 = Sunday … 6 = Saturday. */
export type WeekHours = Period[][];

const t = (h: number, m = 0) => h * 60 + m;
const p = (name: string, meal: Meal, open: number, close: number): Period => ({ name, meal, open, close });

// ------------------------------------------------------------------ published hours

const COMMONS_WEEKDAY = [
  p("Breakfast", "Breakfast", t(7), t(10)),
  p("Light Breakfast", "Breakfast", t(10), t(11)),
  p("Lunch", "Lunch", t(11), t(14)),
  p("Light Lunch", "Lunch", t(14), t(17)),
  p("Dinner", "Dinner", t(17), t(21)),
  p("Late Dinner", "Dinner", t(21), t(22)),
];
const COMMONS_WEEKEND = [
  p("Breakfast", "Breakfast", t(7), t(11)),
  p("Brunch", "Lunch", t(11), t(14)),
  p("Late Lunch", "Lunch", t(14), t(17)),
  p("Dinner", "Dinner", t(17), t(21)),
  p("Late Dinner", "Dinner", t(21), t(22)),
];

const MCEWEN_MON_THU = [
  p("Breakfast", "Breakfast", t(7, 30), t(10)),
  p("Light Breakfast", "Breakfast", t(10), t(11)),
  p("Lunch", "Lunch", t(11), t(14)),
  p("Light Lunch", "Lunch", t(14), t(17)),
  p("Dinner", "Dinner", t(17), t(20)),
];
const MCEWEN_FRI = [p("Breakfast", "Breakfast", t(7, 30), t(10)), p("Lunch", "Lunch", t(11), t(14, 30))];

const DINER_MON_WED = [
  p("Breakfast", "Breakfast", t(9), t(11)),
  p("Lunch", "Lunch", t(11), t(16)),
  p("Dinner", "Dinner", t(16), t(24)),
];
const DINER_THU_FRI = [...DINER_MON_WED, p("Late Night", "Dinner", t(24), t(27))];

export const HOURS: Record<string, WeekHours> = {
  commons: [COMMONS_WEEKEND, ...Array(5).fill(COMMONS_WEEKDAY), COMMONS_WEEKEND],
  mcewen: [[], MCEWEN_MON_THU, MCEWEN_MON_THU, MCEWEN_MON_THU, MCEWEN_MON_THU, MCEWEN_FRI, []],
  diner: [
    [p("Dinner", "Dinner", t(15), t(24))],
    DINER_MON_WED,
    DINER_MON_WED,
    DINER_MON_WED,
    DINER_THU_FRI,
    DINER_THU_FRI,
    [p("Late Night", "Dinner", t(15), t(27))],
  ],
};

// ------------------------------------------------------------------ clock

export type CampusTime = { iso: string; dow: number; minutes: number };

/** Today's date, weekday and time of day on campus. */
export function campusNow(d = new Date()): CampusTime {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { iso: `${parts.year}-${parts.month}-${parts.day}`, dow, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Weekday (0 = Sunday) of a "YYYY-MM-DD" date. */
export const dowOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

// ------------------------------------------------------------------ formatting

/** "7", "7:30", "12" — compact, no am/pm (for the one-line summary). */
function short(min: number) {
  const m = min % t(24);
  const h = Math.floor(m / 60) % 12 || 12;
  return m % 60 ? `${h}:${String(m % 60).padStart(2, "0")}` : `${h}`;
}

/** "7:30 AM", "12 AM". */
export function clock(min: number) {
  const m = min % t(24);
  return `${short(m)} ${m < t(12) ? "AM" : "PM"}`;
}

export const range = (a: number, b: number) => `${clock(a)} – ${clock(b)}`;

/** Merge back-to-back periods of the same meal ("Lunch" + "Light Lunch" → one span). */
export function mealSpans(day: Period[]) {
  const spans: { meal: Meal; name: string; open: number; close: number }[] = [];
  for (const period of day) {
    const last = spans.at(-1);
    if (last && last.meal === period.meal && last.close === period.open) last.close = period.close;
    else spans.push({ meal: period.meal, name: period.name, open: period.open, close: period.close });
  }
  return spans;
}

/** "7 - 11 | 11 - 5 | 5 - 10"; spans reaching midnight get AM/PM ("4 PM - 3 AM") so they stay clear. */
export function summary(day: Period[]) {
  return mealSpans(day)
    .map((s) => (s.close >= t(24) ? `${clock(s.open)} - ${clock(s.close)}` : `${short(s.open)} - ${short(s.close)}`))
    .join(" | ");
}

// ------------------------------------------------------------------ status

export type Status =
  | { open: true; period: Period; closesAt: number }
  /** `opens`: "7 AM", "tomorrow 7:30 AM" or "Mon 7:30 AM"; null if no hours this week. */
  | { open: false; opens: string | null };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Open/closed right now, including windows that ran past midnight from yesterday. */
export function statusAt(week: WeekHours, now: CampusTime): Status {
  const today = week[now.dow];
  const yesterday = week[(now.dow + 6) % 7].map((x) => ({ ...x, open: x.open - t(24), close: x.close - t(24) }));
  // Adjacent windows (Lunch → Light Lunch) count as one stretch of being open.
  const windows = [...yesterday, ...today].sort((a, b) => a.open - b.open);
  const current = windows.find((x) => x.open <= now.minutes && now.minutes < x.close);
  if (current) {
    let closesAt = current.close;
    for (const x of windows) if (x.open === closesAt) closesAt = x.close;
    return { open: true, period: current, closesAt };
  }
  const later = today.find((x) => x.open > now.minutes);
  if (later) return { open: false, opens: clock(later.open) };
  for (let ahead = 1; ahead <= 7; ahead++) {
    const dow = (now.dow + ahead) % 7;
    const first = week[dow][0];
    if (first) return { open: false, opens: `${ahead === 1 ? "tomorrow" : DAY_NAMES[dow]} ${clock(first.open)}` };
  }
  return { open: false, opens: null };
}

/** The meal a hall is serving now, or the next one it serves today. */
export function mealNow(week: WeekHours, now: CampusTime): Meal | null {
  const s = statusAt(week, now);
  if (s.open) return s.period.meal;
  return week[now.dow].find((x) => x.open > now.minutes)?.meal ?? null;
}

/** Tab label for a meal on a given weekday — e.g. Commons calls weekend lunch "Brunch". */
export function mealLabel(week: WeekHours | undefined, dow: number, meal: Meal) {
  return week?.[dow].find((x) => x.meal === meal)?.name === "Brunch" ? "Brunch" : meal;
}
