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
