import { and, eq, gte, lte, min, sql } from "drizzle-orm"
import { game, participant, player, user } from "./db/schema"
import { CommandError } from "./errors"
import { isCurrentPlayer, isGuest, playerName, requirePlayer } from "./groups"
import { METRICS } from "./metrics"
import { requireUser } from "./session"
import { isCalendarDay } from "@/lib/dates"
import type { SQL } from "drizzle-orm"
import type { App } from "./app"
import type { MetricDefinition, MetricId, MetricUnit } from "./metrics"

export type { MetricId, MetricUnit } from "./metrics"

/** A player on the Group Leaderboard for one metric. */
export type RankedPlayer = {
  playerId: string
  name: string
  guest: boolean
  /** Players with the same value share it; the next one skips accordingly. */
  rank: number
  value: number
  /** The line below the value, e.g. "aus 71 Spielen". */
  detail: string
}

/** A player with too few Games for a metric with a minimum. */
export type PendingPlayer = {
  playerId: string
  name: string
  guest: boolean
  games: number
}

export type MetricBoard = {
  id: MetricId
  name: string
  description: string
  unit: MetricUnit
  minGames: number | null
  ranked: Array<RankedPlayer>
  /** Sorted by Games played, most first. */
  pending: Array<PendingPlayer>
}

export type Leaderboard = {
  /** When the Group's first completed Game started; null before one was completed. */
  since: Date | null
  /** Calendar years (German time) with completed Games, newest first. */
  years: Array<number>
  /** One ranking per metric, for the requested period. */
  metrics: Array<MetricBoard>
}

/** A day in German time, `YYYY-MM-DD`; both ends are included. */
export type Period = { from?: string; to?: string }

/**
 * The day a Game started, in German time: a Game at 23:30 on New Year's Eve
 * belongs to the old year.
 */
const startDay = sql`(${game.startedAt} at time zone 'UTC' at time zone 'Europe/Berlin')::date`

// Case does not matter, accents do; the same order as the player list.
const byName = new Intl.Collator("de", { sensitivity: "accent", numeric: true })

/**
 * The Group Leaderboard: every current Player, Guests included, ranked by
 * each metric over the Group's completed Games in the period (all of them
 * without one). Cancelled and running Games never count; Former Players are
 * left out. Only the Group's Players may see it.
 */
export async function getLeaderboard(
  app: App,
  headers: Headers,
  input: { groupId: string } & Period
): Promise<Leaderboard> {
  const me = await requireUser(app, headers)
  await requirePlayer(app, input.groupId, me.id)
  const period = parsePeriod(input)

  const finished = and(
    eq(game.groupId, input.groupId),
    eq(game.status, "finished")
  )
  const counts = Object.fromEntries(
    METRICS.map((m) => [m.id, m.count])
  ) as Record<MetricId, SQL<number>>
  const [rows, [range], years] = await Promise.all([
    app.db
      .select({
        playerId: player.id,
        name: player.name,
        userId: player.userId,
        formerNumber: player.formerNumber,
        userName: user.name,
        played: sql<number>`count(*)::int`,
        ...counts,
      })
      .from(participant)
      .innerJoin(game, eq(game.id, participant.gameId))
      .innerJoin(player, eq(player.id, participant.playerId))
      .leftJoin(user, eq(user.id, player.userId))
      .where(
        and(
          finished,
          isCurrentPlayer,
          period.from ? gte(startDay, period.from) : undefined,
          period.to ? lte(startDay, period.to) : undefined
        )
      )
      .groupBy(player.id, user.id),
    app.db
      .select({ since: min(game.startedAt) })
      .from(game)
      .where(finished),
    app.db
      .selectDistinct({
        year: sql<number>`extract(year from ${startDay})::int`.as("year"),
      })
      .from(game)
      .where(finished),
  ])

  const players = rows.map((row) => ({
    playerId: row.playerId,
    name: playerName({
      name: row.name,
      formerNumber: row.formerNumber,
      user: row.userName === null ? null : { name: row.userName },
    }),
    guest: isGuest(row),
    games: row.played,
    counts: row,
  }))

  return {
    since: range.since ?? null,
    years: years.map((y) => y.year).sort((a, b) => b - a),
    metrics: METRICS.map((metric) => rank(metric, players)),
  }
}

type PlayerCounts = {
  playerId: string
  name: string
  guest: boolean
  games: number
  counts: Record<MetricId, number>
}

function rank(
  metric: MetricDefinition & { id: MetricId },
  players: Array<PlayerCounts>
): MetricBoard {
  const { minGames } = metric
  const entries = players.map((p) => ({
    ...p,
    count: p.counts[metric.id],
  }))
  const counted = entries.filter(
    (p) => minGames === null || p.games >= minGames
  )
  // Compared as fractions, count / games, so equal rates are exactly equal.
  const compare = (
    a: { count: number; games: number },
    b: { count: number; games: number }
  ) => {
    const diff = metric.perGame
      ? b.count * a.games - a.count * b.games
      : b.count - a.count
    return metric.order === "desc" ? diff : -diff
  }
  counted.sort((a, b) => compare(a, b) || byName.compare(a.name, b.name))

  const ranked: Array<RankedPlayer> = []
  counted.forEach((p, index) => {
    const previous = index > 0 ? counted[index - 1] : null
    ranked.push({
      playerId: p.playerId,
      name: p.name,
      guest: p.guest,
      rank:
        previous && compare(previous, p) === 0
          ? ranked[index - 1].rank
          : index + 1,
      value: metric.perGame ? p.count / p.games : p.count,
      detail: metric.detail({ count: p.count, games: p.games }),
    })
  })

  const pending = entries
    .filter((p) => minGames !== null && p.games < minGames)
    .sort((a, b) => b.games - a.games || byName.compare(a.name, b.name))
    .map(({ playerId, name, guest, games }) => ({
      playerId,
      name,
      guest,
      games,
    }))

  return {
    id: metric.id,
    name: metric.name,
    description: metric.description,
    unit: metric.unit,
    minGames,
    ranked,
    pending,
  }
}

/** Both ends or neither, each a real day, `from` not after `to`. */
function parsePeriod(input: Period): Period {
  const { from, to } = input
  if (from === undefined && to === undefined) return {}
  if (!isCalendarDay(from) || !isCalendarDay(to) || from > to) {
    throw new CommandError("invalidPeriod")
  }
  return { from, to }
}
