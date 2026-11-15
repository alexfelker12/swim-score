import { and, eq, gte, lte, min, sql } from "drizzle-orm"
import { game, participant, player } from "./db/schema"
import { CommandError } from "./errors"
import { METRICS } from "./metrics"
import { isCalendarDay } from "@/lib/dates"
import type { SQL } from "drizzle-orm"
import type { App } from "./app"
import type { MetricId } from "./metrics"

// What the Group Leaderboard and Personal Stats share: which Games count,
// the Period, and one aggregate per metric over a player's Participants.

/** Days in German time, `YYYY-MM-DD`, both ends included; neither for all Games. */
export type Period = { from?: string; to?: string }

/** What every metric counts for one player (or one player in one Group). */
export type MetricCounts = { games: number } & Record<MetricId, number>

/** Both ends or neither, each a real day, `from` not after `to`. */
export function parsePeriod(input: Period): Period {
  const { from, to } = input
  if (from === undefined && to === undefined) return {}
  if (!isCalendarDay(from) || !isCalendarDay(to) || from > to) {
    throw new CommandError("invalidPeriod")
  }
  return { from, to }
}

/**
 * The day a Game started, in German time: a Game at 23:30 on New Year's Eve
 * belongs to the old year.
 */
const startDay = sql`(${game.startedAt} at time zone 'UTC' at time zone 'Europe/Berlin')::date`

/** Games that count for statistics: completed ones, never cancelled or running. */
export const isCompleted = eq(game.status, "finished")

/** Games started within the Period; no condition without one. */
export function inPeriod(period: Period): SQL | undefined {
  return and(
    period.from ? gte(startDay, period.from) : undefined,
    period.to ? lte(startDay, period.to) : undefined
  )
}

/**
 * Select fields for the Games played and every metric's count, aggregated
 * over the `participant` rows grouped by the caller.
 */
export function metricCountFields() {
  const counts = Object.fromEntries(
    METRICS.map((m) => [m.id, m.count])
  ) as Record<MetricId, SQL<number>>
  return { ...counts, games: sql<number>`count(*)::int` }
}

/**
 * When the first completed Game among `where` started, and the calendar
 * years (German time) with such Games, newest first: the choices of the
 * period sheet.
 */
export async function periodChoices(
  app: App,
  where: SQL | undefined
): Promise<{ since: Date | null; years: Array<number> }> {
  const condition = and(isCompleted, where)
  const [[range], years] = await Promise.all([
    app.db
      .select({ since: min(game.startedAt) })
      .from(participant)
      .innerJoin(game, eq(game.id, participant.gameId))
      .innerJoin(player, eq(player.id, participant.playerId))
      .where(condition),
    app.db
      .selectDistinct({
        year: sql<number>`extract(year from ${startDay})::int`.as("year"),
      })
      .from(participant)
      .innerJoin(game, eq(game.id, participant.gameId))
      .innerJoin(player, eq(player.id, participant.playerId))
      .where(condition),
  ])
  return {
    since: range.since ?? null,
    years: years.map((y) => y.year).sort((a, b) => b - a),
  }
}

/** A metric's value from its count: per Game for rates, null without Games. */
export function metricValue(
  metric: { perGame: boolean },
  count: number,
  games: number
): number | null {
  if (!metric.perGame) return count
  return games === 0 ? null : count / games
}
