import { and, desc, eq, exists, inArray, max, ne, or, sql } from "drizzle-orm"
import { game, participant, player } from "./db/schema"
import { listMyGroups, myGroupRows, playerName } from "./groups"
import { pageOfSorted } from "./paging"
import type { Page, PageRequest } from "./paging"
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
}

/**
 * The start page of the signed-in account:
 * - the running Games it plays in, to continue or watch;
 * - the Group for "Neues Spiel": that of the latest Game it started or took
 *   part in (cancelled ones aside, like "zuletzt gespielt"), otherwise the
 *   Group it created or joined last.
 * Its Groups come a page at a time from `listHomeGroups`. Groups it has left
 * no longer count.
 */
export async function getHome(app: App, headers: Headers): Promise<Home> {
  const me = await requireUser(app, headers)
  const mine = await listMyGroups(app, headers)
  if (mine.length === 0) return { runningGames: [], newGame: null }
  const groupIds = mine.map((g) => g.id)
  const inMyGroups = inArray(game.groupId, groupIds)
  const iTakePart = exists(
    app.db
      .select({ one: sql`1` })
      .from(participant)
      .innerJoin(player, eq(player.id, participant.playerId))
      .where(and(eq(participant.gameId, game.id), eq(player.userId, me.id)))
  )

  const [running, lastPlayed, latestMine] = await Promise.all([
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
    lastPlayedIn(app, groupIds),
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
  ])

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
      lastPlayedAt: lastPlayedAtIn(lastPlayed, target.id),
    },
  }
}

/**
 * The account's Groups for "Meine Gruppen", a page at a time (#59): played
 * most recently first (cancelled Games aside), Groups without a Game after
 * them, newest joined first; with whether a Game runs.
 */
export async function listHomeGroups(
  app: App,
  headers: Headers,
  input: { page?: PageRequest } = {}
): Promise<Page<HomeGroup>> {
  const me = await requireUser(app, headers)
  const mine = await myGroupRows(app, me.id)
  if (mine.length === 0) return { items: [], next: null }
  const groupIds = mine.map((g) => g.id)
  const [lastPlayed, runningGroups] = await Promise.all([
    lastPlayedIn(app, groupIds),
    app.db
      .selectDistinct({ groupId: game.groupId })
      .from(game)
      .where(and(inArray(game.groupId, groupIds), eq(game.status, "running"))),
  ])
  const groups = mine.map((g) => ({
    id: g.id,
    name: g.name,
    playerCount: g.playerCount,
    running: runningGroups.some((row) => row.groupId === g.id),
    lastPlayedAt: lastPlayedAtIn(lastPlayed, g.id),
    joinedAt: g.joinedAt,
  }))
  const page = pageOfSorted(groups, input.page, {
    shape: ["number|null", "number", "string"],
    keyOf: (g) => [
      g.lastPlayedAt?.getTime() ?? null,
      g.joinedAt.getTime(),
      g.id,
    ],
    // Never played (null) last; then newest joined; then by id.
    compare: (a, b) =>
      Number(b[0] ?? -Infinity) - Number(a[0] ?? -Infinity) ||
      Number(b[1]) - Number(a[1]) ||
      String(a[2]).localeCompare(String(b[2])),
  })
  return {
    next: page.next,
    items: page.items.map(({ joinedAt: _, ...group }) => group),
  }
}

function lastPlayedAtIn(
  lastPlayed: Array<{ groupId: string; at: Date | null }>,
  groupId: string
) {
  return lastPlayed.find((row) => row.groupId === groupId)?.at ?? null
}

/** When each Group last played, cancelled Games aside. */
function lastPlayedIn(app: App, groupIds: Array<string>) {
  return app.db
    .select({ groupId: game.groupId, at: max(game.startedAt) })
    .from(game)
    .where(and(inArray(game.groupId, groupIds), ne(game.status, "cancelled")))
    .groupBy(game.groupId)
}
