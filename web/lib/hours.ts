import type { Meal } from "./types";

/** Hours are published in campus time; use it no matter where the viewer is. */
const TIME_ZONE = "America/New_York";

/**
 * One service window. Times are minutes after midnight; a close past 24:00
 * (e.g. 3 a.m. = 27 * 60) means the window runs into the next day.
 */
export type Period = { name: string; meal: Meal; open: number; close: number };
/**
 * Index 0 = Sunday … 6 = Saturday. `overrides` replaces a whole day's windows on a specific
 * "YYYY-MM-DD" date (breaks, holidays); an empty list means closed all day. Read days with `dayHours`.
 */
export type WeekHours = Period[][] & { overrides?: Record<string, Period[]> };

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

const PUB_LUNCH = [p("Lunch Buffet", "Lunch", t(11), t(13, 30))];
const PUB_LUNCH_AND_NIGHT = [...PUB_LUNCH, p("Pub", "Dinner", t(20), t(26))];

// ------------------------------------------------------------------ fall break 2026 (Wed 10/14 – Sun 10/18)

const BREAK_COMMONS_DINNER = p("Dinner", "Dinner", t(17), t(19, 30));
const BREAK_COMMONS = [
  p("Breakfast", "Breakfast", t(8), t(10)),
  p("Lunch", "Lunch", t(12), t(14)),
  p("Dinner", "Dinner", t(17), t(19)),
];

const FALL_BREAK = {
  commons: {
    "2026-10-14": [...COMMONS_WEEKDAY.filter((x) => x.meal !== "Dinner"), BREAK_COMMONS_DINNER],
    "2026-10-15": BREAK_COMMONS,
    "2026-10-16": BREAK_COMMONS,
    "2026-10-17": [p("Brunch", "Lunch", t(11), t(14)), p("Dinner", "Dinner", t(17), t(19))],
  },
  mcewen: { "2026-10-14": [], "2026-10-15": [], "2026-10-16": [], "2026-10-17": [], "2026-10-18": [] },
  diner: {
    "2026-10-14": [p("Breakfast", "Breakfast", t(9), t(11)), p("Lunch", "Lunch", t(11), t(14))],
    "2026-10-15": [],
    "2026-10-16": [],
    "2026-10-17": [],
    "2026-10-18": [],
  },
  littlePub: { "2026-10-14": [], "2026-10-15": [], "2026-10-16": [], "2026-10-17": [], "2026-10-18": [] },
} satisfies Record<string, Record<string, Period[]>>;

// ------------------------------------------------------------------ Thanksgiving break 2026 (Tue 11/17 – Sun 11/29)

const closed = (...dates: string[]) => Object.fromEntries(dates.map((d) => [d, [] as Period[]]));
/** Every date from `from` through `to`, inclusive. */
const datesThrough = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

const BREAK_DINNER = p("Dinner", "Dinner", t(17), t(19));
const BREAK_BRUNCH_DAY = [p("Brunch", "Lunch", t(11), t(14)), BREAK_DINNER];
const BREAK_MCEWEN_WEEKDAY = [
  p("Breakfast", "Breakfast", t(8), t(9)),
  p("Lunch", "Lunch", t(12), t(14)),
  BREAK_DINNER,
];

const THANKSGIVING = {
  commons: {
    // Lunch runs until 4, then a short dinner; closed from Saturday until it reopens Sun 11/29.
    "2026-11-20": [
      ...COMMONS_WEEKDAY.filter((x) => x.meal !== "Dinner" && x.name !== "Light Lunch"),
      p("Light Lunch", "Lunch", t(14), t(16)),
      BREAK_DINNER,
    ],
    ...closed(...datesThrough("2026-11-21", "2026-11-28")),
  },
  mcewen: {
    // Wed 11/18 is regular hours (closes after dinner).
    ...closed("2026-11-19", "2026-11-20", "2026-11-29"),
    "2026-11-21": BREAK_BRUNCH_DAY,
    "2026-11-22": BREAK_BRUNCH_DAY,
    "2026-11-23": BREAK_MCEWEN_WEEKDAY,
    "2026-11-24": BREAK_MCEWEN_WEEKDAY,
    "2026-11-25": BREAK_MCEWEN_WEEKDAY,
    "2026-11-26": BREAK_BRUNCH_DAY,
    "2026-11-27": BREAK_MCEWEN_WEEKDAY,
    "2026-11-28": BREAK_BRUNCH_DAY,
  },
  diner: {
    "2026-11-20": [p("Breakfast", "Breakfast", t(9), t(11)), p("Lunch", "Lunch", t(11), t(14))],
    ...closed(...datesThrough("2026-11-21", "2026-11-29")),
  },
  littlePub: {
    // Bar keeps regular hours Tuesday but there's no pub lunch; fully closed from Wednesday.
    "2026-11-17": PUB_LUNCH_AND_NIGHT.filter((x) => x.meal !== "Lunch"),
    ...closed(...datesThrough("2026-11-18", "2026-11-29")),
  },
} satisfies Record<string, Record<string, Period[]>>;

// ------------------------------------------------------------------ cafés (hamilton.edu/campuslife/where-to-eat)

// Cafés have one all-day service, not meals; `meal` is only there because Period needs one.
const cafe = (open: number, close: number) => [p("Open", "Lunch", open, close)];
const FOJO_WEEKDAY = cafe(t(9), t(16));
const FOJO_FRI = cafe(t(9), t(15));
const EUPHORIA_WEEKDAY = cafe(t(8, 30), t(16));
// The cafés only say they "may close during school breaks"; assume they're closed for all of Thanksgiving break.
const CAFES_THANKSGIVING = closed(...datesThrough("2026-11-21", "2026-11-29"));

const withOverrides = (week: Period[][], overrides: Record<string, Period[]>): WeekHours =>
  Object.assign(week, { overrides });

export const HOURS: Record<string, WeekHours> = {
  commons: withOverrides([COMMONS_WEEKEND, ...Array(5).fill(COMMONS_WEEKDAY), COMMONS_WEEKEND], { ...FALL_BREAK.commons, ...THANKSGIVING.commons }),
  mcewen: withOverrides(
    [[], MCEWEN_MON_THU, MCEWEN_MON_THU, MCEWEN_MON_THU, MCEWEN_MON_THU, MCEWEN_FRI, []],
    { ...FALL_BREAK.mcewen, ...THANKSGIVING.mcewen },
  ),
  diner: withOverrides([
    [p("Dinner", "Dinner", t(15), t(24))],
    DINER_MON_WED,
    DINER_MON_WED,
    DINER_MON_WED,
    DINER_THU_FRI,
    DINER_THU_FRI,
    [p("Late Night", "Dinner", t(15), t(27))],
  ], { ...FALL_BREAK.diner, ...THANKSGIVING.diner }),
  littlePub: withOverrides(
    [[], PUB_LUNCH, PUB_LUNCH_AND_NIGHT, PUB_LUNCH_AND_NIGHT, PUB_LUNCH_AND_NIGHT, PUB_LUNCH, []],
    { ...FALL_BREAK.littlePub, ...THANKSGIVING.littlePub },
  ),
  euphoria: withOverrides(
    [[], ...Array(5).fill(EUPHORIA_WEEKDAY), cafe(t(12), t(16))],
    CAFES_THANKSGIVING,
  ),
  fojoNorth: withOverrides([[], FOJO_WEEKDAY, FOJO_WEEKDAY, FOJO_WEEKDAY, FOJO_WEEKDAY, FOJO_FRI, []], CAFES_THANKSGIVING),
  fojoSouth: withOverrides(
    [cafe(t(11), t(14)), FOJO_WEEKDAY, FOJO_WEEKDAY, FOJO_WEEKDAY, FOJO_WEEKDAY, FOJO_FRI, []],
    CAFES_THANKSGIVING,
  ),
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

/** "YYYY-MM-DD" shifted by `days`. */
export function addDays(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The service windows on a specific date: a break/holiday override if there is one, else the usual weekday. */
export const dayHours = (week: WeekHours, iso: string): Period[] => week.overrides?.[iso] ?? week[dowOf(iso)];

/** Whether the hall ever serves this meal. */
export const servesMealEver = (week: WeekHours, meal: Meal) => week.some((d) => d.some((x) => x.meal === meal));

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

/** "7–10 AM", "11 AM–2 PM", "4 PM–12 AM": one AM/PM when both ends share it. */
export function compactRange(open: number, close: number) {
  const half = (m: number) => ((m % t(24)) < t(12) ? "AM" : "PM");
  return half(open) === half(close) && close - open < t(12)
    ? `${short(open)}–${short(close)} ${half(close)}`
    : `${clock(open)}–${clock(close)}`;
}

/**
 * Today's main service for each meal, e.g. [{ name: "Breakfast", hours: "7–10 AM" }, { name: "Lunch", hours: "11 AM–2 PM" }].
 * Uses each meal's first window, the same as the first line of the hall page's hours
 * (extensions like "Light Lunch" are listed there, not here).
 */
export function summaryParts(day: Period[]) {
  const seen = new Set<string>();
  return day
    .filter((x) => !seen.has(x.meal) && seen.add(x.meal))
    .map((x) => ({ name: x.name, hours: compactRange(x.open, x.close) }));
}

// ------------------------------------------------------------------ status

export type Status =
  | { open: true; period: Period; closesAt: number }
  /** `opens`: "7 AM", "tomorrow 7:30 AM", "Mon 7:30 AM" or "Sun 11/29 7 AM"; null if no hours in the next two weeks. */
  | { open: false; opens: string | null };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Open/closed right now, including windows that ran past midnight from yesterday. */
export function statusAt(week: WeekHours, now: CampusTime): Status {
  const today = dayHours(week, now.iso);
  const yesterday = dayHours(week, addDays(now.iso, -1)).map((x) => ({ ...x, open: x.open - t(24), close: x.close - t(24) }));
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
  // Look two weeks out so long break closures still say when the hall reopens.
  for (let ahead = 1; ahead <= 14; ahead++) {
    const date = addDays(now.iso, ahead);
    const first = dayHours(week, date)[0];
    if (!first) continue;
    const day = ahead === 1 ? "tomorrow" : DAY_NAMES[dowOf(date)];
    // Past this week, add the date so "Sun" isn't mistaken for this coming Sunday.
    const when = ahead < 7 ? day : `${day} ${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
    return { open: false, opens: `${when} ${clock(first.open)}` };
  }
  return { open: false, opens: null };
}

/** The meal a hall is serving now, or the next one it serves today. */
export function mealNow(week: WeekHours, now: CampusTime): Meal | null {
  const s = statusAt(week, now);
  if (s.open) return s.period.meal;
  return dayHours(week, now.iso).find((x) => x.open > now.minutes)?.meal ?? null;
}

/** Service names that replace the meal name on its tab. */
const TAB_NAMES = new Set(["Brunch", "Pub"]);

/** Tab label for a meal on a given date — e.g. Commons calls weekend lunch "Brunch", Little Pub's night service is "Pub". */
export function mealLabel(week: WeekHours | undefined, iso: string, meal: Meal) {
  const name = week && dayHours(week, iso).find((x) => x.meal === meal)?.name;
  return name && TAB_NAMES.has(name) ? name : meal;
}
