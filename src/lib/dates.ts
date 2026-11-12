// Dates are shown in German time, on the server and in the browser alike, so
// server-rendered pages match what the browser renders.
const TIME_ZONE = "Europe/Berlin"

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE })
const time = new Intl.DateTimeFormat("de", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
})
const day = new Intl.DateTimeFormat("de", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
})
const longDay = new Intl.DateTimeFormat("de", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "long",
})
const month = new Intl.DateTimeFormat("de", {
  timeZone: TIME_ZONE,
  month: "long",
})
const monthYear = new Intl.DateTimeFormat("de", {
  timeZone: TIME_ZONE,
  month: "long",
  year: "numeric",
})
const year = new Intl.DateTimeFormat("de", {
  timeZone: TIME_ZONE,
  year: "numeric",
})

/** "heute, 21:40", "gestern, 21:40" or "Do., 29. Okt., 21:40". */
export function formatStarted(date: Date, now = new Date()): string {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const label =
    dayKey.format(date) === dayKey.format(now)
      ? "heute"
      : dayKey.format(date) === dayKey.format(yesterday)
        ? "gestern"
        : day.format(date)
  return `${label}, ${time.format(date)}`
}

/** "Do., 29. Okt." */
export function formatDay(date: Date): string {
  return day.format(date)
}

/** "Oktober", or "Oktober 2025" outside the current year. */
export function formatMonth(date: Date, now = new Date()): string {
  return year.format(date) === year.format(now)
    ? month.format(date)
    : monthYear.format(date)
}

/** Groups by month, e.g. for list headings; same key for the same month. */
export function monthKey(date: Date): string {
  return dayKey.format(date).slice(0, 7)
}

/** Same calendar day in German time. */
export function isToday(date: Date, now = new Date()): boolean {
  return dayKey.format(date) === dayKey.format(now)
}

/** "Do., 5. November" */
export function formatLongDay(date: Date): string {
  return longDay.format(date)
}

/** "21:40" */
export function formatTime(date: Date): string {
  return time.format(date)
}

/** "März 2024" */
export function formatMonthYear(date: Date): string {
  return monthYear.format(date)
}

/** The year of a date in German time. */
export function yearOf(date: Date): number {
  return Number(year.format(date))
}

// Calendar days (`YYYY-MM-DD`) have no time of day: shown as written, in UTC.
const dayMonth = new Intl.DateTimeFormat("de", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
})
const dayMonthYear = new Intl.DateTimeFormat("de", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
})

function calendarDay(key: string): Date {
  return new Date(`${key}T00:00:00Z`)
}

/**
 * "1. März bis 30. Juni 2026", or "1. Dezember 2025 bis 31. Januar 2026"
 * across years; for two calendar days `YYYY-MM-DD`.
 */
export function formatDayRange(from: string, to: string): string {
  const end = dayMonthYear.format(calendarDay(to))
  if (from === to) return end
  const start =
    from.slice(0, 4) === to.slice(0, 4)
      ? dayMonth.format(calendarDay(from))
      : dayMonthYear.format(calendarDay(from))
  return `${start} bis ${end}`
}

/** "1.3.–30.6.2026", or "1.12.2025–31.1.2026" across years. */
export function formatShortDayRange(from: string, to: string): string {
  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  const end = `${td}.${tm}.${ty}`
  if (from === to) return end
  const start = fy === ty ? `${fd}.${fm}.` : `${fd}.${fm}.${fy}`
  return `${start}\u2013${end}`
}

/** A real calendar day written as `YYYY-MM-DD` (no 30 February). */
export function isCalendarDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  return calendarDay(value).toISOString().slice(0, 10) === value
}

/** Today in German time, as `YYYY-MM-DD`. */
export function todayKey(now = new Date()): string {
  return dayKey.format(now)
}
