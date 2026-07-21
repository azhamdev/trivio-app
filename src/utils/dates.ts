// Calendar-date helpers. Everything works in local time and normalizes to
// start-of-day, so trip dates compare cleanly regardless of when in the day
// an expense or check happens.

export const DAY_MS = 86400000;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function todayStart(): number {
  return startOfDay(Date.now());
}

export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

// Inclusive: a trip from the 21st to the 25th is 5 days.
export function daysBetweenInclusive(start: number, end: number): number {
  return Math.round((startOfDay(end) - startOfDay(start)) / DAY_MS) + 1;
}

export function formatDateShort(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// Compact range for cards, no year: "21–25 Jul", "28 Jul – 2 Aug".
export function formatDateRangeShort(start: number, end: number): string {
  const s = new Date(start);
  const e = new Date(end);
  if (isSameDay(start, end)) return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`;
  }
  return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`;
}

// Full range with year for detail screens: "21–25 Jul 2026".
export function formatDateRange(start: number, end: number): string {
  const s = new Date(start);
  const e = new Date(end);
  if (isSameDay(start, end)) return formatDateShort(start);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
  }
  return `${formatDateShort(start)} – ${formatDateShort(end)}`;
}

// Monday-start week bounds — used for personal-budget "this week" presets.
export function startOfWeek(ts: number = Date.now()): number {
  const day = new Date(startOfDay(ts)).getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(ts), diffToMonday);
}

export function endOfWeek(ts: number = Date.now()): number {
  return addDays(startOfWeek(ts), 6);
}

export function startOfMonth(ts: number = Date.now()): number {
  const d = new Date(ts);
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), 1).getTime());
}

export function endOfMonth(ts: number = Date.now()): number {
  const d = new Date(ts);
  return startOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime());
}

export function monthTitle(year: number, month: number): string {
  return `${MONTHS_LONG[month]} ${year}`;
}

// A 7-column grid for a month: leading/trailing nulls pad partial weeks so the
// calendar always renders full rows. Values are start-of-day timestamps.
export function buildMonthGrid(year: number, month: number): (number | null)[] {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d).getTime());
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
