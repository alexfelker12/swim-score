import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import {
  preview,
  replay,
  standardRuleSet,
  validateSeatingOrder,
} from "@/rules-engine"
import { game, gameEvent, participant, player, takeover } from "./db/schema"
import { CommandError } from "./errors"
import {
  isCurrentPlayer,
  getGroup,
  isGuest,
  playerName,
  requirePlayer,
} from "./groups"
import { requireUser } from "./session"
import { takeoverOpensAt } from "@/lib/takeover"
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
  /** The Participant who keeps score; null once their account is deleted. */
  scorekeeperParticipantId: string | null
  isScorekeeper: boolean
  /**
   * Since when the Scorekeeper's device is offline, while the Game runs;
   * null while connected or nothing is known (ADR 0003).
   */
  scorekeeperOfflineSince: Date | null
  /** The server's clock when this was loaded, to count down from. */
  serverTime: Date
  /** The viewer is a Participant with an account who does not keep score, and the Game runs. */
  canTakeOver: boolean
  /** In the order they happened. */
  takeovers: Array<TakeoverView>
  /**
   * The secret of the Game's Spectator link, for every Player of the Group
   * while the Game runs; null once it is over.
   */
  spectatorToken: string | null
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

/** A Participant taking over as Scorekeeper, for the Game's history. */
export type TakeoverView = {
  /** How many of the Game's Events came before it. */
  afterEvents: number
  /** The Participant who took over. */
  by: string
  /** The one replaced; null when their account was deleted. */
  from: string | null
  /** The one replaced was offline. */
  fromWasOffline: boolean
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
  const row = await loadGame(app, eq(game.id, input.gameId))
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
    scorekeeperParticipantId: scorekeeperParticipant(row),
    isScorekeeper: row.scorekeeperId === me.id,
    scorekeeperOfflineSince: scorekeeperOfflineSince(row),
    serverTime: app.now(),
    canTakeOver:
      row.status === "running" &&
      row.scorekeeperId !== me.id &&
      row.participants.some((p) => p.player.userId === me.id),
    takeovers: row.takeovers.map((t) => ({
      afterEvents: Math.min(t.afterEvents, row.events.length),
      by: t.participantId,
      from: t.previousParticipantId,
      fromWasOffline: t.previousOffline,
    })),
    spectatorToken: row.status === "running" ? row.spectatorToken : null,
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
    await advanceRunningGame(tx, input.gameId, input.expectedVersion)
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
  await markConnected(app, input.gameId, me.id)
  await notifyGameChanged(app, input.gameId, version)
  return { version }
}

/**
 * Adds the Tiebreak that decided the last Round to its loss, after the fact:
 * the loss is recorded with one tap, the Tiebreak only when wanted. A
 * Tiebreak recorded before is replaced. `tiebreak` names everyone in it, the
 * loser included; the rules decide who may be. Only the Scorekeeper may, on
 * top of the version they have seen.
 */
export async function addTiebreak(
  app: App,
  headers: Headers,
  input: { gameId: string; expectedVersion: number; tiebreak: Array<string> }
): Promise<{ version: number }> {
  const me = await requireUser(app, headers)
  const row = await requireScorekeeper(app, input.gameId, me.id)
  if (row.status !== "running") throw new CommandError("gameNotRunning")
  if (row.version !== input.expectedVersion) {
    throw new CommandError("versionConflict")
  }
  const last = row.events.at(-1)
  if (last?.event.type !== "lost") throw new CommandError("noLossForTiebreak")
  const event = parseEvent({
    type: "lost",
    loser: last.event.loser,
    tiebreak: input.tiebreak,
  })
  if (!event) throw new CommandError("invalidEvent")
  // The loss as if recorded with its Tiebreak in the first place.
  const before = replayGame({ ...row, events: row.events.slice(0, -1) })
  const amended = preview(before, row.ruleSet, event)
  if (!amended.ok) throw new CommandError(amended.reason.code)
  const version = input.expectedVersion + 1
  await app.db.transaction(async (tx) => {
    await advanceRunningGame(tx, input.gameId, input.expectedVersion)
    await tx
      .update(gameEvent)
      .set({ event })
      .where(
        and(
          eq(gameEvent.gameId, input.gameId),
          eq(gameEvent.version, last.version)
        )
      )
  })
  await markConnected(app, input.gameId, me.id)
  await notifyGameChanged(app, input.gameId, version)
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
    // A takeover after the undone Event now comes after the one before it,
    // and before anything recorded next.
    await tx
      .update(takeover)
      .set({ afterEvents: last.version - 1 })
      .where(
        and(
          eq(takeover.gameId, input.gameId),
          gt(takeover.afterEvents, last.version - 1)
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
  await markConnected(app, input.gameId, me.id)
  await notifyGameChanged(app, input.gameId, version)
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
    .returning({ version: game.version })
  if (cancelled.length === 0) throw new CommandError("gameNotRunning")
  await notifyGameChanged(app, input.gameId, cancelled[0].version)
}

/**
 * Makes the viewer the Scorekeeper (ADR 0003), if they are a Participant with
 * an account. While the Scorekeeper's device is connected (or nothing is
 * known about it), or their account is deleted, at once; for a short grace
 * period after it went offline not at all (a dead zone at the bar); after
 * that only with `confirmOffline`, the warning that Events their device has
 * not sent yet will be refused. The Game's version moves on, so the former
 * Scorekeeper's steps are refused.
 */
export async function takeOver(
  app: App,
  headers: Headers,
  input: { gameId: string; confirmOffline?: boolean }
): Promise<{ version: number }> {
  const me = await requireUser(app, headers)
  const row = await app.db.query.game.findFirst({
    where: eq(game.id, input.gameId),
    columns: {
      groupId: true,
      status: true,
      version: true,
      scorekeeperId: true,
    },
    with: {
      participants: {
        columns: { id: true, connected: true, presenceAt: true },
        with: { player: { columns: { userId: true } } },
      },
      events: { columns: { version: true } },
    },
  })
  if (!row) throw new CommandError("gameNotFound")
  await requirePlayer(app, row.groupId, me.id, "gameNotFound")
  const mine = row.participants.find((p) => p.player.userId === me.id)
  if (!mine) throw new CommandError("notParticipant")
  if (row.status !== "running") throw new CommandError("gameNotRunning")
  if (row.scorekeeperId === me.id) throw new CommandError("alreadyScorekeeper")
  const previous = row.participants.find(
    (p) => row.scorekeeperId !== null && p.player.userId === row.scorekeeperId
  )
  const offlineSince = previous ? offlineSinceOf(previous) : null
  if (offlineSince) {
    if (app.now() < takeoverOpensAt(offlineSince)) {
      throw new CommandError("scorekeeperJustWentOffline")
    }
    if (!input.confirmOffline) {
      throw new CommandError("takeoverNeedsConfirmation")
    }
  }
  const version = row.version + 1
  await app.db.transaction(async (tx) => {
    await advanceRunningGame(tx, input.gameId, row.version, {
      scorekeeperId: me.id,
    })
    await tx.insert(takeover).values({
      gameId: input.gameId,
      version,
      afterEvents: row.events.length,
      participantId: mine.id,
      previousParticipantId: previous?.id ?? null,
      previousOffline: offlineSince !== null,
    })
  })
  await markConnected(app, input.gameId, me.id)
  await notifyGameChanged(app, input.gameId, version)
  return { version }
}

/**
 * What Pusher reported about the devices of `userId` on a Game's presence
 * channel (from its webhook): one connected, or the last one gone. Older
 * reports than the one known are ignored, as are unknown Games and
 * accounts. Devices are told when it was the Scorekeeper's.
 */
export async function recordPresence(
  app: App,
  input: { gameId: string; userId: string; connected: boolean; at: Date }
): Promise<void> {
  const changed = await app.db
    .update(participant)
    .set({ connected: input.connected, presenceAt: input.at })
    .where(
      and(
        participantOf(app, input.gameId, input.userId),
        or(
          isNull(participant.presenceAt),
          lte(participant.presenceAt, input.at)
        ),
        or(
          isNull(participant.connected),
          ne(participant.connected, input.connected)
        )
      )
    )
    .returning({ id: participant.id })
  if (changed.length === 0) return
  const row = await app.db.query.game.findFirst({
    where: eq(game.id, input.gameId),
    columns: { scorekeeperId: true, status: true },
  })
  if (row?.status !== "running" || row.scorekeeperId !== input.userId) return
  try {
    await app.notifier.scorekeeperPresenceChanged(input.gameId)
  } catch (error) {
    console.error(`Game ${input.gameId}: presence notification failed`, error)
  }
}

/**
 * Who the viewer is on the Game's presence channel: any Participant with an
 * account may join, as their account, so the server learns via Pusher
 * whether the Scorekeeper is connected.
 */
export async function authorizePresence(
  app: App,
  headers: Headers,
  input: { gameId: string }
): Promise<{ userId: string }> {
  const me = await requireUser(app, headers)
  const row = await app.db.query.game.findFirst({
    where: eq(game.id, input.gameId),
    columns: { groupId: true },
    with: {
      participants: {
        columns: { id: true },
        with: { player: { columns: { userId: true } } },
      },
    },
  })
  if (!row) throw new CommandError("gameNotFound")
  await requirePlayer(app, row.groupId, me.id, "gameNotFound")
  if (!row.participants.some((p) => p.player.userId === me.id)) {
    throw new CommandError("notParticipant")
  }
  return { userId: me.id }
}

/** A running Game as Spectators see it: no Players' or accounts' ids. */
export type SpectatorView = {
  id: string
  groupName: string
  ruleSet: RuleSet
  version: number
  /** Display Name of the Scorekeeper; null once their account is deleted. */
  scorekeeper: string | null
  scorekeeperParticipantId: string | null
  /** As in `GameView`. */
  scorekeeperOfflineSince: Date | null
  serverTime: Date
  /** In Seating Order. */
  participants: Array<{ id: string; name: string }>
  events: Array<GameEvent>
  state: GameState
}

/**
 * The running Game behind a Spectator link, for anyone who has it, with or
 * without an account; hence no session headers. Once the Game is over, the
 * link shows nothing.
 */
export async function getSpectatorGame(
  app: App,
  input: { token: string }
): Promise<SpectatorView> {
  const row = await loadGame(app, eq(game.spectatorToken, input.token))
  if (!row) throw new CommandError("spectatorLinkNotFound")
  if (row.status !== "running") throw new CommandError("spectatorLinkExpired")
  return {
    id: row.id,
    groupName: row.group.name,
    ruleSet: row.ruleSet,
    version: row.version,
    scorekeeper: row.scorekeeper?.name ?? null,
    scorekeeperParticipantId: scorekeeperParticipant(row),
    scorekeeperOfflineSince: scorekeeperOfflineSince(row),
    serverTime: app.now(),
    participants: row.participants.map((p) => ({
      id: p.id,
      name: playerName(p.player),
    })),
    events: row.events.map((e) => e.event),
    state: replayGame(row),
  }
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

/** A Game with what it shows: Group name, Scorekeeper, Participants, Events. */
function loadGame(app: App, where: SQL) {
  return app.db.query.game.findFirst({
    where,
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
      takeovers: { orderBy: (t, { asc }) => asc(t.version) },
    },
  })
}

/** The Participant whose account keeps score, if it still exists. */
function scorekeeperParticipant(row: {
  scorekeeperId: string | null
  participants: ReadonlyArray<{ id: string; player: { userId: string | null } }>
}): string | null {
  if (row.scorekeeperId === null) return null
  return (
    row.participants.find((p) => p.player.userId === row.scorekeeperId)?.id ??
    null
  )
}

/** Since when a Participant's devices are all offline; null if connected or unknown. */
function offlineSinceOf(p: {
  connected: boolean | null
  presenceAt: Date | null
}): Date | null {
  return p.connected === false ? p.presenceAt : null
}

/** Since when the Scorekeeper is offline, while the Game runs. */
function scorekeeperOfflineSince(row: {
  status: GameStatus
  scorekeeperId: string | null
  participants: ReadonlyArray<{
    connected: boolean | null
    presenceAt: Date | null
    player: { userId: string | null }
  }>
}): Date | null {
  if (row.status !== "running" || row.scorekeeperId === null) return null
  const keeper = row.participants.find(
    (p) => p.player.userId === row.scorekeeperId
  )
  return keeper ? offlineSinceOf(keeper) : null
}

/**
 * Whoever records something or takes over has their device online, whatever
 * Pusher last reported (a webhook can get lost). Pusher's time of that report
 * stays: it orders Pusher's reports, by Pusher's clock, and a later one that
 * says offline again still counts.
 */
async function markConnected(app: App, gameId: string, userId: string) {
  await app.db
    .update(participant)
    .set({ connected: true })
    .where(
      and(participantOf(app, gameId, userId), eq(participant.connected, false))
    )
}

/** The Participant row of `userId`'s account in the Game. */
function participantOf(app: App, gameId: string, userId: string) {
  return and(
    eq(participant.gameId, gameId),
    inArray(
      participant.playerId,
      app.db
        .select({ id: player.id })
        .from(player)
        .where(eq(player.userId, userId))
    )
  )
}

/**
 * Tells the devices showing the Game about its new version. The change is
 * already saved, so a failing notification only logs: devices still see it
 * when they load the Game again.
 */
async function notifyGameChanged(app: App, gameId: string, version: number) {
  try {
    await app.notifier.gameChanged(gameId, version)
  } catch (error) {
    console.error(
      `Game ${gameId}: notification of version ${version} failed`,
      error
    )
  }
}

type Transaction = Parameters<Parameters<App["db"]["transaction"]>[0]>[0]

/**
 * Moves a running Game from the version the device has seen to the next.
 * Only one device can, and not once the Game was cancelled in the meantime.
 */
async function advanceRunningGame(
  tx: Transaction,
  gameId: string,
  expectedVersion: number,
  /** What else changes with it. */
  changes: { scorekeeperId?: string } = {}
) {
  const moved = await tx
    .update(game)
    .set({ ...changes, version: expectedVersion + 1 })
    .where(
      and(
        eq(game.id, gameId),
        eq(game.version, expectedVersion),
        eq(game.status, "running")
      )
    )
    .returning({ id: game.id })
  if (moved.length === 0) throw new CommandError("versionConflict")
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
