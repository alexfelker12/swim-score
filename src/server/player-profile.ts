import { and, asc, eq, inArray } from "drizzle-orm"
import { game, group, participant, player, user } from "./db/schema"
import { CommandError } from "./errors"
import { byName, isCurrentPlayer } from "./groups"
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
import type { MetricId, MetricUnit } from "./metrics"
import type { Period } from "./stats"

/** One metric's value in Personal Stats. */
export type PersonalMetric = {
  id: MetricId
  name: string
  unit: MetricUnit
  /** Null for a rate without any Game to divide by. */
  value: number | null
}

/**
 * The Personal Stats of one Group, on a card that links to its Leaderboard:
 * the rates as the Group Leaderboard computes them (#62). Null below the
 * Leaderboard's minimum number of Games, like a Player it doesn't rank yet.
 */
export type GroupStats = {
  groupId: string
  name: string
  games: number
  winRate: number | null
  swimRate: number | null
  bombsPerGame: number | null
}

export type PlayerProfile = {
  userId: string
  /** Display Name. */
  name: string
  image: string | null
  /** The viewer's own profile. */
  isMe: boolean
  /** How many Groups the account plays in; only for the account itself. */
  groupCount: number | null
  /** When the account's first completed Game started; null before one. */
  since: Date | null
  /** Calendar years (German time) with the account's completed Games, newest first. */
  years: Array<number>
  /**
   * Over all the account's Games, also in Groups it has left: Teilnahmen
   * first, then the other metrics.
   */
  totals: Array<PersonalMetric>
  /**
   * Per Group: all of the account's Groups on its own profile, only shared
   * ones on anyone else's. Most Games first.
   */
  groups: Array<GroupStats>
}

const METRIC_BY_ID = Object.fromEntries(METRICS.map((m) => [m.id, m]))

/** Teilnahmen leads the tiles; every other metric follows in its order. */
const TILE_ORDER = [
  ...METRICS.filter((m) => m.id === "games"),
  ...METRICS.filter((m) => m.id !== "games"),
]

/**
 * An account's Player Profile with its Personal Stats over the Period: totals
 * over all its Games (also in Groups it has left), and per Group it plays
 * in. Visible to the account
 * itself and to accounts that share at least one Group with it (both current
 * Players); the per-Group part then only lists those shared Groups. To
 * everyone else the account does not exist.
 */
export async function getPlayerProfile(
  app: App,
  headers: Headers,
  input: { userId: string } & Period
): Promise<PlayerProfile> {
  const me = await requireUser(app, headers)
  const period = parsePeriod(input)
  const isMe = input.userId === me.id

  const [account, theirGroups, myGroups] = await Promise.all([
    app.db.query.user.findFirst({
      where: eq(user.id, input.userId),
      columns: { id: true, name: true, image: true },
    }),
    currentGroups(app, input.userId),
    isMe ? null : currentGroups(app, me.id),
  ])
  const shared = myGroups
    ? theirGroups.filter((g) => myGroups.some((mine) => mine.id === g.id))
    : theirGroups
  if (!account || (!isMe && shared.length === 0)) {
    throw new CommandError("playerNotFound")
  }

  // All their Games, also in Groups they have left: Personal Stats are
  // their own record (only the Group Leaderboard leaves Former Players out).
  const theirs = eq(player.userId, input.userId)
  const fields = metricCountFields()
  const [[total], perGroup, choices] = await Promise.all([
    app.db
      .select(fields)
      .from(participant)
      .innerJoin(game, eq(game.id, participant.gameId))
      .innerJoin(player, eq(player.id, participant.playerId))
      .where(and(theirs, isCompleted, inPeriod(period))),
    shared.length === 0
      ? []
      : app.db
          .select({ groupId: game.groupId, ...fields })
          .from(participant)
          .innerJoin(game, eq(game.id, participant.gameId))
          .innerJoin(player, eq(player.id, participant.playerId))
          .where(
            and(
              theirs,
              isCompleted,
              inPeriod(period),
              inArray(
                game.groupId,
                shared.map((g) => g.id)
              )
            )
          )
          .groupBy(game.groupId),
    periodChoices(app, theirs),
  ])

  return {
    userId: account.id,
    name: account.name,
    image: account.image,
    isMe,
    groupCount: isMe ? theirGroups.length : null,
    ...choices,
    totals: TILE_ORDER.map((metric) => ({
      id: metric.id,
      name: metric.name,
      unit: metric.unit,
      value: metricValue(metric, total[metric.id], total.games),
    })),
    groups: shared
      .map((g) => {
        const counts = perGroup.find((row) => row.groupId === g.id)
        const games = counts?.games ?? 0
        const rate = (id: "winRate" | "swimRate" | "bombsPerGame") => {
          const metric = METRIC_BY_ID[id]
          return games < (metric.minGames ?? 0)
            ? null
            : metricValue(metric, counts?.[id] ?? 0, games)
        }
        return {
          groupId: g.id,
          name: g.name,
          games,
          winRate: rate("winRate"),
          swimRate: rate("swimRate"),
          bombsPerGame: rate("bombsPerGame"),
        }
      })
      .sort((a, b) => b.games - a.games || byName.compare(a.name, b.name)),
  }
}

/** The Groups an account currently plays in. */
function currentGroups(app: App, userId: string) {
  return app.db
    .select({ id: group.id, name: group.name })
    .from(player)
    .innerJoin(group, eq(group.id, player.groupId))
    .where(and(eq(player.userId, userId), isCurrentPlayer))
    .orderBy(asc(group.name))
}
