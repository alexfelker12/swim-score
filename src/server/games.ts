import { and, desc, eq, inArray, sql } from "drizzle-orm"
import {
  preview,
  replay,
  standardRuleSet,
  validateSeatingOrder,
} from "@/rules-engine"
import { game, gameEvent, participant, player } from "./db/schema"
import { CommandError } from "./errors"
import {
  isCurrentPlayer,
  getGroup,
  isGuest,
  playerName,
  requirePlayer,
} from "./groups"
import { requireUser } from "./session"
import type { GameEvent, GameState, RuleSet } from "@/rules-engine"
import type { App } from "./app"
import type { GameStatus } from "./db/schema"

/** How a Participant did; written when the Game finishes. */
export type ParticipantSummary = {
  won: boolean
  /** Was the Game's Swimmer. */
  swam: boolean
  bombs: number
  livesLost: number
  /** 1 for the first to go Out; those Out in the same Round share it. Null for the Winner. */
  outPosition: number | null
}

export type GameParticipant = {
  /** The Participant's id, which Events refer to. */
  id: string
  playerId: string
  name: string
  guest: boolean
  summary: ParticipantSummary | null
}

export type GameView = {
  id: string
  groupId: string
  groupName: string
  status: GameStatus
  ruleSet: RuleSet
  /**
   * The Game's revision: counts every change (an Event recorded or undone,
   * the Game cancelled). The next step is sent on top of it.
   */
  version: number
  /** Display Name of the Scorekeeper; null once their account is deleted. */
  scorekeeper: string | null
  isScorekeeper: boolean
  /** In Seating Order. */
  participants: Array<GameParticipant>
  events: Array<GameEvent>
  state: GameState
  startedAt: Date
  /** When the Game finished or was cancelled. */
  finishedAt: Date | null
  /**
   * Until when the Scorekeeper can still undo the last step of a finished
   * Game; null for a running or cancelled one.
   */
  undoableUntil: Date | null
}

/** How long after the end of a Game its last step can still be undone. */
const UNDO_AFTER_FINISH_MS = 10 * 60_000

export type NewGame = {
  groupName: string
  /** Every current Player of the Group, sorted by name. */
  players: Array<{ id: string; name: string; guest: boolean }>
  /** Player ids of the Group's last Game, in its Seating Order. */
  preselected: Array<string>
}

/** What "Spiel starten" offers: the Group's Players and the last Seating Order. */
export async function getNewGame(
  app: App,
  headers: Headers,
  input: { groupId: string }
): Promise<NewGame> {
  const group = await getGroup(app, headers, input)
  const last = await app.db.query.game.findFirst({
    where: eq(game.groupId, input.groupId),
    orderBy: desc(game.startedAt),
    columns: {},
    with: {
      participants: { orderBy: participant.seat, columns: { playerId: true } },
    },
  })
  const present = new Set(group.players.map((p) => p.id))
  return {
    groupName: group.name,
    players: group.players.map(({ id, name, guest }) => ({ id, name, guest })),
    preselected: (last?.participants ?? [])
      .map((p) => p.playerId)
      .filter((id) => present.has(id)),
  }
}

/**
 * Starts a Game with these Players of the Group in this Seating Order; the
 * first deals first. Whoever starts it is the Scorekeeper.
 */
export async function startGame(
  app: App,
  headers: Headers,
  input: { groupId: string; playerIds: Array<string> }
): Promise<{ id: string }> {
  const me = await requireUser(app, headers)
  await requirePlayer(app, input.groupId, me.id)
  const ruleSet = standardRuleSet
  const seating = validateSeatingOrder(ruleSet, input.playerIds)
  if (!seating.ok) throw new CommandError(seating.reason.code)
  const known = await app.db.query.player.findMany({
    // Former Players can no longer be seated.
    where: and(
      eq(player.groupId, input.groupId),
      inArray(player.id, input.playerIds),
      isCurrentPlayer
    ),
    columns: { id: true },
  })
  if (known.length !== input.playerIds.length) {
    throw new CommandError("unknownPlayer")
  }
  const id = crypto.randomUUID()
  await app.db.transaction(async (tx) => {
    await tx.insert(game).values({
      id,
      groupId: input.groupId,
      ruleSet,
      scorekeeperId: me.id,
    })
    await tx.insert(participant).values(
      input.playerIds.map((playerId, seat) => ({
        id: crypto.randomUUID(),
        gameId: id,
        playerId,
        seat,
      }))
    )
  })
  return { id }
}

/** A Game with its Participants, Events and current state; for the Group's Players. */
export async function getGame(
  app: App,
  headers: Headers,
  input: { gameId: string }
): Promise<GameView> {
  const me = await requireUser(app, headers)
  const row = await app.db.query.game.findFirst({
    where: eq(game.id, input.gameId),
    with: {
      group: { columns: { name: true } },
      scorekeeper: { columns: { name: true } },
      participants: {
        orderBy: participant.seat,
        with: {
          player: {
            columns: { name: true, userId: true, formerNumber: true },
            with: { user: { columns: { name: true } } },
          },
        },
      },
      events: { orderBy: (e, { asc }) => asc(e.version) },
    },
  })
  if (!row) throw new CommandError("gameNotFound")
  await requirePlayer(app, row.groupId, me.id, "gameNotFound")
  const participants = row.participants.map((p) => ({
    id: p.id,
    playerId: p.playerId,
    name: playerName(p.player),
    guest: isGuest(p.player),
    summary:
      p.won === null
        ? null
        : {
            won: p.won,
            swam: p.swam ?? false,
            bombs: p.bombs ?? 0,
            livesLost: p.livesLost ?? 0,
            outPosition: p.outPosition,
          },
  }))
  const events = row.events.map((e) => e.event)
  return {
    id: row.id,
    groupId: row.groupId,
    groupName: row.group.name,
    status: row.status,
    ruleSet: row.ruleSet,
    version: row.version,
    scorekeeper: row.scorekeeper?.name ?? null,
    isScorekeeper: row.scorekeeperId === me.id,
    participants,
    events,
    state: replayGame(row),
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    undoableUntil:
      row.status === "finished" && row.finishedAt
        ? undoDeadline(row.finishedAt)
        : null,
  }
}

/**
 * Records the next Event of a running Game. Only the Scorekeeper may, and
 * only on top of the version they have seen; the rules decide the rest.
 */
export async function recordEvent(
  app: App,
  headers: Headers,
  input: { gameId: string; expectedVersion: number; event: GameEvent }
): Promise<{ version: number }> {
  const me = await requireUser(app, headers)
  const event = parseEvent(input.event)
  if (!event) throw new CommandError("invalidEvent")
  const row = await requireScorekeeper(app, input.gameId, me.id)
  if (row.status !== "running") throw new CommandError("gameNotRunning")
  if (row.version !== input.expectedVersion) {
    throw new CommandError("versionConflict")
  }
  const state = replayGame(row)
  const next = preview(state, row.ruleSet, event)
  if (!next.ok) throw new CommandError(next.reason.code)
  const version = input.expectedVersion + 1
  await app.db.transaction(async (tx) => {
    // Only one device can move the Game from this version to the next, and
    // not once it was cancelled in the meantime.
    const moved = await tx
      .update(game)
      .set({ version })
      .where(
        and(
          eq(game.id, input.gameId),
          eq(game.version, input.expectedVersion),
          eq(game.status, "running")
        )
      )
      .returning({ id: game.id })
    if (moved.length === 0) throw new CommandError("versionConflict")
    await tx.insert(gameEvent).values({
      gameId: input.gameId,
      // The Event's position, after those recorded before it.
      version: row.events.length + 1,
      event,
      recordedById: me.id,
    })
    if (next.state.finished) {
      await tx
        .update(game)
        .set({ status: "finished", finishedAt: app.now() })
        .where(eq(game.id, input.gameId))
      const played = { ...row, events: [...row.events, { event }] }
      for (const { id } of row.participants) {
        await tx
          .update(participant)
          .set(summarize(played, id))
          .where(eq(participant.id, id))
      }
    }
  })
  return { version }
}

/**
 * Undoes the last Event: it is deleted, as if it never happened. Step by
 * step as far back as wanted while the Game runs; after the end only the
 * last step, within 10 minutes, and the Game then runs again without its
 * summary. Only the Scorekeeper may, on top of the version they have seen.
 */
export async function undoEvent(
  app: App,
  headers: Headers,
  input: { gameId: string; expectedVersion: number }
): Promise<{ version: number }> {
  const me = await requireUser(app, headers)
  const row = await requireScorekeeper(app, input.gameId, me.id)
  if (row.status === "cancelled") throw new CommandError("gameNotRunning")
  if (row.version !== input.expectedVersion) {
    throw new CommandError("versionConflict")
  }
  const last = row.events.at(-1)
  if (!last) throw new CommandError("nothingToUndo")
  const finished = row.status === "finished"
  if (
    finished &&
    (!row.finishedAt || app.now() > undoDeadline(row.finishedAt))
  ) {
    throw new CommandError("undoExpired")
  }
  // The revision counts on, so a device that saw the undone Event cannot
  // act on it any more.
  const version = input.expectedVersion + 1
  await app.db.transaction(async (tx) => {
    // Only one device can move the Game on from this version.
    const moved = await tx
      .update(game)
      .set({ version, status: "running", finishedAt: null })
      .where(
        and(
          eq(game.id, input.gameId),
          eq(game.version, input.expectedVersion),
          eq(game.status, row.status)
        )
      )
      .returning({ id: game.id })
    if (moved.length === 0) throw new CommandError("versionConflict")
    await tx
      .delete(gameEvent)
      .where(
        and(
          eq(gameEvent.gameId, input.gameId),
          eq(gameEvent.version, last.version)
        )
      )
    if (finished) {
      // The summary was written for the end that is now undone.
      await tx
        .update(participant)
        .set({
          won: null,
          swam: null,
          bombs: null,
          livesLost: null,
          outPosition: null,
        })
        .where(eq(participant.gameId, input.gameId))
    }
  })
  return { version }
}

/**
 * Cancels a running Game for good: it stays in the Group's list, but counts
 * towards no statistic. Only the Scorekeeper may.
 */
export async function cancelGame(
  app: App,
  headers: Headers,
  input: { gameId: string }
): Promise<void> {
  const me = await requireUser(app, headers)
  const row = await requireScorekeeper(app, input.gameId, me.id)
  if (row.status !== "running") throw new CommandError("gameNotRunning")
  const cancelled = await app.db
    .update(game)
    // A change like any other: steps still sent on the old version fail.
    .set({
      status: "cancelled",
      finishedAt: app.now(),
      version: sql`${game.version} + 1`,
    })
    .where(and(eq(game.id, input.gameId), eq(game.status, "running")))
    .returning({ id: game.id })
  if (cancelled.length === 0) throw new CommandError("gameNotRunning")
}

export type GameListEntry = {
  id: string
  status: GameStatus
  startedAt: Date
  participantCount: number
  /** The current Round, or the last one of a finished Game. */
  round: number
  /** Null once the Scorekeeper's account is deleted. */
  scorekeeper: string | null
  winner: string | null
  /** The Swimmer so far, or of the finished Game. */
  swimmer: string | null
}

/** The Group's Games, newest first. */
export async function listGames(
  app: App,
  headers: Headers,
  input: { groupId: string }
): Promise<Array<GameListEntry>> {
  const me = await requireUser(app, headers)
  await requirePlayer(app, input.groupId, me.id)
  const rows = await app.db.query.game.findMany({
    where: eq(game.groupId, input.groupId),
    orderBy: desc(game.startedAt),
    with: {
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
  })
  return rows.map((row) => {
    const state = replayGame(row)
    const nameOf = (id: string | null) => {
      const found = row.participants.find((p) => p.id === id)
      return found ? playerName(found.player) : null
    }
    return {
      id: row.id,
      status: row.status,
      startedAt: row.startedAt,
      participantCount: row.participants.length,
      round: state.round,
      scorekeeper: row.scorekeeper?.name ?? null,
      winner: nameOf(state.winner),
      swimmer: nameOf(state.swimmer),
    }
  })
}

/**
 * The Game with its Participants and Events, for its Scorekeeper only. Other
 * Players of the Group are told they do not keep score; to anyone else the
 * Game does not exist.
 */
async function requireScorekeeper(app: App, gameId: string, userId: string) {
  const row = await app.db.query.game.findFirst({
    where: eq(game.id, gameId),
    columns: {
      groupId: true,
      ruleSet: true,
      scorekeeperId: true,
      status: true,
      version: true,
      finishedAt: true,
    },
    with: {
      participants: { orderBy: participant.seat, columns: { id: true } },
      events: { orderBy: (e, { asc }) => asc(e.version) },
    },
  })
  if (!row) throw new CommandError("gameNotFound")
  await requirePlayer(app, row.groupId, userId, "gameNotFound")
  if (row.scorekeeperId !== userId) throw new CommandError("notScorekeeper")
  return row
}

function undoDeadline(finishedAt: Date): Date {
  return new Date(finishedAt.getTime() + UNDO_AFTER_FINISH_MS)
}

/** A stored Game as the rules engine takes it. */
type RecordedGame = {
  ruleSet: RuleSet
  /** In Seating Order. */
  participants: ReadonlyArray<{ id: string }>
  events: ReadonlyArray<{ event: GameEvent }>
}

/** The Game's state, derived from its Events (ADR 0001). */
function replayGame(recorded: RecordedGame): GameState {
  return replay(
    recorded.ruleSet,
    recorded.participants.map((p) => p.id),
    recorded.events.map((e) => e.event)
  )
}

/**
 * How a Participant did. Lives lost counts every Round that went against
 * them, the one that made them the Swimmer included (as shown at the end).
 */
function summarize(recorded: RecordedGame, id: string): ParticipantSummary {
  const { ruleSet } = recorded
  const events = recorded.events.map((e) => e.event)
  let state = replayGame({ ...recorded, events: [] })
  let livesLost = 0
  for (const event of events) {
    const step = preview(state, ruleSet, event)
    if (!step.ok) {
      throw new Error(`Recorded Event breaks the rules: ${step.reason.code}`)
    }
    const { lostLife, becameSwimmer } = step.effects
    if (lostLife.includes(id) || becameSwimmer === id) livesLost++
    state = step.state
  }
  const out = state.outOrder.findIndex((round) => round.includes(id))
  return {
    won: state.winner === id,
    swam: state.swimmer === id,
    bombs: events.filter((e) => e.type === "bomb" && e.thrower === id).length,
    livesLost,
    outPosition: out === -1 ? null : out + 1,
  }
}

/** The Event in its known shape, or null; what the client sends is not trusted. */
function parseEvent(value: unknown): GameEvent | null {
  if (typeof value !== "object" || value === null) return null
  const event = value as Record<string, unknown>
  const isId = (x: unknown): x is string => typeof x === "string"
  switch (event.type) {
    case "lost": {
      if (!isId(event.loser)) return null
      if (event.tiebreak === undefined) {
        return { type: "lost", loser: event.loser }
      }
      if (!Array.isArray(event.tiebreak) || !event.tiebreak.every(isId)) {
        return null
      }
      return { type: "lost", loser: event.loser, tiebreak: event.tiebreak }
    }
    case "bomb": {
      if (!isId(event.thrower)) return null
      if (event.swimmer === undefined) {
        return { type: "bomb", thrower: event.thrower }
      }
      if (!isId(event.swimmer)) return null
      return { type: "bomb", thrower: event.thrower, swimmer: event.swimmer }
    }
    case "extraRound":
      return { type: "extraRound" }
    default:
      return null
  }
}
