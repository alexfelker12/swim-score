import { isCalendarDay } from "@/lib/dates"
import type { Period } from "@/server/stats"

/**
 * The Period of a statistic from a page's search params (`from`, `to`):
 * both real days, or neither for all Games.
 */
export function periodFromSearch(search: Record<string, unknown>): Period {
  return isCalendarDay(search.from) && isCalendarDay(search.to)
    ? { from: search.from, to: search.to }
    : {}
}
