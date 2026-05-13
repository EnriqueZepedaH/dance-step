// Pure date helpers anchored to America/Chicago (the only city in v1).
// No date library — `Intl.DateTimeFormat` with `timeZone` does the
// shift work, and we use UTC-noon anchors to step calendar days
// without DST off-by-one.

export const CHICAGO_TZ = "America/Chicago";

const KEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: CHICAGO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const LONG_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: CHICAGO_TZ,
});

const MONTH_LABEL_FMT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: CHICAGO_TZ,
});

const CHIP_DOW_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: CHICAGO_TZ,
});
const CHIP_DAY_FMT = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  timeZone: CHICAGO_TZ,
});
const CHIP_MONTH_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: CHICAGO_TZ,
});

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

export type DateKey = string; // "YYYY-MM-DD" in Chicago wall time
export type MonthKey = string; // "YYYY-MM" in Chicago wall time

export function isValidDateKey(value: string | null | undefined): value is DateKey {
  return !!value && DATE_KEY_RE.test(value);
}

export function isValidMonthKey(value: string | null | undefined): value is MonthKey {
  return !!value && MONTH_KEY_RE.test(value);
}

export function toChicagoDateKey(input: Date | string): DateKey {
  const date = typeof input === "string" ? new Date(input) : input;
  return KEY_FMT.format(date);
}

export function chicagoToday(): DateKey {
  return toChicagoDateKey(new Date());
}

export function chicagoCurrentMonth(): MonthKey {
  return chicagoToday().slice(0, 7);
}

// UTC-noon anchor for a calendar-date key. Noon UTC always lands in
// the same calendar day across every Olson timezone we care about,
// so this is a safe input for further Intl formatting.
function dateKeyAnchor(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function formatChicagoLongDate(key: DateKey): string {
  return LONG_FMT.format(dateKeyAnchor(key));
}

export function chipParts(key: DateKey): {
  dow: string;
  day: string;
  month: string;
} {
  const anchor = dateKeyAnchor(key);
  return {
    dow: CHIP_DOW_FMT.format(anchor),
    day: CHIP_DAY_FMT.format(anchor),
    month: CHIP_MONTH_FMT.format(anchor),
  };
}

export function addDays(key: DateKey, days: number): DateKey {
  const anchor = dateKeyAnchor(key);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return toChicagoDateKey(anchor);
}

export function generateRailDates(count: number, startKey?: DateKey): DateKey[] {
  const start = startKey ?? chicagoToday();
  const out: DateKey[] = [];
  for (let i = 0; i < count; i++) out.push(addDays(start, i));
  return out;
}

export function shiftMonth(monthKey: MonthKey, delta: number): MonthKey {
  const [y, m] = monthKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1 + delta, 1, 12));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type MonthGrid = {
  monthKey: MonthKey;
  label: string;
  firstWeekday: number; // 0 = Sunday
  days: DateKey[];
};

export function monthRange(monthKey: MonthKey): MonthGrid {
  const [y, m] = monthKey.split("-").map(Number);
  const firstAnchor = new Date(Date.UTC(y, m - 1, 1, 12));
  const lastDay = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days: DateKey[] = [];
  const mm = String(m).padStart(2, "0");
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${y}-${mm}-${String(d).padStart(2, "0")}`);
  }
  return {
    monthKey,
    label: MONTH_LABEL_FMT.format(firstAnchor),
    firstWeekday,
    days,
  };
}

export function compareDateKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareMonthKeys(a: MonthKey, b: MonthKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
