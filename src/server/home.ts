import { and, desc, eq, exists, inArray, max, ne, or, sql } from "drizzle-orm"
import { game, participant, player } from "./db/schema"
import { listMyGroups, playerName } from "./groups"
import { requireUser } from "./session"
import { replay } from "@/rules-engine"
import type { App } from "./app"

/** A running Game the account plays in, as the start page shows it. */
export type RunningGame = {
  id: string
  groupId: string
  groupName: string
  startedAt: Date
  /** When the last Event was recorded, or the start without one. */
  lastActivityAt: Date
  round: number
  participantCount: number
  /** Null once the Scorekeeper's account is deleted. */
  scorekeeper: string | null
  /** "Weiterzählen" for the Scorekeeper, "Mitsehen" for everyone else. */
  isScorekeeper: boolean
  /** Who is still in, in Seating Order: Lives left, or swimming. */
  standings: Array<{ name: string; lives: number; swimming: boolean }>
}

/** A card under "Meine Gruppen". */
export type HomeGroup = {
  id: string
  name: string
  playerCount: number
  /** A Game of the Group is running. */
  running: boolean
  /** When the Group's latest Game started, cancelled ones aside; null without. */
  lastPlayedAt: Date | null
}

export type Home = {
  /** Most recently active first. */
  runningGames: Array<RunningGame>
  /** Where "Neues Spiel" starts one; null without a Group. */
  newGame: {
    groupId: string
    groupName: string
    lastPlayedAt: Date | null
  } | null
  /** Played most recently first; Groups without a Game after them, newest first. */
  groups: Array<HomeGroup>
}

/**
 * The start page of the signed-in account:
 * - the running Games it plays in, to continue or watch;
 * - the Group for "Neues Spiel": that of the latest Game it started or took
 *   part in (cancelled ones aside, like "zuletzt gespielt"), otherwise the
 *   Group it created or joined last;
 * - its Groups, with whether a Game runs and when they last played.
 * Groups it has left no longer count.
 */
export async function getHome(app: App, headers: Headers): Promise<Home> {
  const me = await requireUser(app, headers)
  const mine = await listMyGroups(app, headers)
  if (mine.length === 0) return { runningGames: [], newGame: null, groups: [] }
  const groupIds = mine.map((g) => g.id)
  const inMyGroups = inArray(game.groupId, groupIds)
  const iTakePart = exists(
    app.db
      .select({ one: sql`1` })
      .from(participant)
      .innerJoin(player, eq(player.id, participant.playerId))
      .where(and(eq(participant.gameId, game.id), eq(player.userId, me.id)))
  )

  const [running, lastPlayed, latestMine, runningGroups] = await Promise.all([
    app.db.query.game.findMany({
      where: and(inMyGroups, eq(game.status, "running"), iTakePart),
      orderBy: desc(game.startedAt),
      with: {
        group: { columns: { name: true } },
        scorekeeper: { columns: { name: true } },
        participants: {
          orderBy: participant.seat,
          columns: { id: true },
          with: {
            player: {
              columns: { name: true, formerNumber: true },
              with: { user: { columns: { name: true } } },
            },
          },
        },
        events: { orderBy: (e, { asc }) => asc(e.version) },
      },
    }),
    app.db
      .select({ groupId: game.groupId, at: max(game.startedAt) })
      .from(game)
      .where(and(inMyGroups, ne(game.status, "cancelled")))
      .groupBy(game.groupId),
    app.db
      .select({ groupId: game.groupId })
      .from(game)
      .where(
        and(
          inMyGroups,
          ne(game.status, "cancelled"),
          or(eq(game.scorekeeperId, me.id), iTakePart)
        )
      )
      .orderBy(desc(game.startedAt))
      .limit(1),
    app.db
      .selectDistinct({ groupId: game.groupId })
      .from(game)
      .where(and(inMyGroups, eq(game.status, "running"))),
  ])

  const lastPlayedAt = (groupId: string) =>
    lastPlayed.find((row) => row.groupId === groupId)?.at ?? null
  const groups = mine
    .map((g) => ({
      id: g.id,
      name: g.name,
      playerCount: g.playerCount,
      running: runningGroups.some((row) => row.groupId === g.id),
      lastPlayedAt: lastPlayedAt(g.id),
    }))
    // Stable: Groups without Games keep the newest-joined-first order.
    .sort(
      (a, b) =>
        (b.lastPlayedAt?.getTime() ?? -Infinity) -
          (a.lastPlayedAt?.getTime() ?? -Infinity) || 0
    )

  const target = mine.find((g) => g.id === latestMine.at(0)?.groupId) ?? mine[0]

  return {
    runningGames: running
      .map((row) => {
        const state = replay(
          row.ruleSet,
          row.participants.map((p) => p.id),
          row.events.map((e) => e.event)
        )
        const names = new Map(
          row.participants.map((p) => [p.id, playerName(p.player)])
        )
        return {
          id: row.id,
          groupId: row.groupId,
          groupName: row.group.name,
          startedAt: row.startedAt,
          lastActivityAt: row.events.at(-1)?.recordedAt ?? row.startedAt,
          round: state.round,
          participantCount: row.participants.length,
          scorekeeper: row.scorekeeper?.name ?? null,
          isScorekeeper: row.scorekeeperId === me.id,
          standings: state.participants
            .filter((p) => p.status !== "out")
            .map((p) => ({
              name: names.get(p.id) ?? "",
              lives: p.lives,
              swimming: p.status === "swimming",
            })),
        }
      })
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime()),
    newGame: {
      groupId: target.id,
      groupName: target.name,
      lastPlayedAt: lastPlayedAt(target.id),
    },
    groups,
  }
}
