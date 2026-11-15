import { and, eq } from "drizzle-orm"
import { game, participant, player, user } from "./db/schema"
import {
  byName,
  isCurrentPlayer,
  isGuest,
  playerName,
  requirePlayer,
} from "./groups"
import { METRICS } from "./metrics"
import { requireUser } from "./session"
import {
  inPeriod,
  isCompleted,
  metricCountFields,
  metricValue,
  parsePeriod,
  periodChoices,
} from "./stats"
import type { App } from "./app"
import type { MetricDefinition, MetricId, MetricUnit } from "./metrics"
import type { MetricCounts, Period } from "./stats"

export type { MetricId, MetricUnit } from "./metrics"

/** A player on the Group Leaderboard for one metric. */
export type RankedPlayer = {
  playerId: string
  /** The account behind the Player, for their Player Profile; null for a Guest. */
  userId: string | null
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
  /** The account behind the Player, for their Player Profile; null for a Guest. */
  userId: string | null
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

  const inGroup = eq(game.groupId, input.groupId)
  const [rows, choices] = await Promise.all([
    app.db
      .select({
        playerId: player.id,
        name: player.name,
        userId: player.userId,
        formerNumber: player.formerNumber,
        userName: user.name,
        ...metricCountFields(),
      })
      .from(participant)
      .innerJoin(game, eq(game.id, participant.gameId))
      .innerJoin(player, eq(player.id, participant.playerId))
      .leftJoin(user, eq(user.id, player.userId))
      .where(and(inGroup, isCompleted, isCurrentPlayer, inPeriod(period)))
      .groupBy(player.id, user.id),
    periodChoices(app, inGroup),
  ])

  const players = rows.map((row) => ({
    playerId: row.playerId,
    userId: row.userId,
    name: playerName({
      name: row.name,
      formerNumber: row.formerNumber,
      user: row.userName === null ? null : { name: row.userName },
    }),
    guest: isGuest(row),
    counts: row,
  }))

  return {
    ...choices,
    metrics: METRICS.map((metric) => rank(metric, players)),
  }
}

type PlayerCounts = {
  playerId: string
  userId: string | null
  name: string
  guest: boolean
  counts: MetricCounts
}

function rank(
  metric: MetricDefinition & { id: MetricId },
  players: Array<PlayerCounts>
): MetricBoard {
  const { minGames } = metric
  const entries = players.map((p) => ({
    ...p,
    games: p.counts.games,
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
      userId: p.userId,
      name: p.name,
      guest: p.guest,
      rank:
        previous && compare(previous, p) === 0
          ? ranked[index - 1].rank
          : index + 1,
      // Ranked players have played, so a rate has a value.
      value: metricValue(metric, p.count, p.games) ?? 0,
      detail: metric.detail({ count: p.count, games: p.games }),
    })
  })

  const pending = entries
    .filter((p) => minGames !== null && p.games < minGames)
    .sort((a, b) => b.games - a.games || byName.compare(a.name, b.name))
    .map(({ playerId, userId, name, guest, games }) => ({
      playerId,
      userId,
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
