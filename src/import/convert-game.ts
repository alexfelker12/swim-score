import { preview, replay, standardRuleSet, validate } from "@/rules-engine"
import type { GameEvent, GameState, RuleSet } from "@/rules-engine"

// The old app (score-tracker) stored a Game as a list of snapshots, one per
// action ("GameRound"): every Participant's Lives, who swims, who deals, and
// on a Bomb who threw it. This turns them into the Events of the new model
// (ADR 0001) and checks that replaying those Events gives the very same
// snapshots.

/** One stored snapshot of the old app, as in its `GameRound.data`. */
export type OldSnapshot = {
  players: ReadonlyArray<{ id: string; lifes: number; order: number }>
  playerSwimming?: string | null
  /** Set on the snapshot after a Bomb, to who threw it. */
  nukeBy?: string | null
  /**
   * Missing in the first Games (until early May 2025), before the old app
   * kept track of who deals.
   */
  dealer?: string
}

/** The old snapshots of a Game, by their position (0 is the start). */
export type OldRound = { round: number; data: OldSnapshot }

export type ConvertedGame = {
  /** Old Participant ids in Seating Order; seat 0 deals first. */
  seating: Array<string>
  /** The Events, naming Participants by their old ids. */
  events: Array<GameEvent>
}

/** The old Games were all played by the standard rules. */
export const OLD_RULE_SET: RuleSet = standardRuleSet

/** A snapshot that no Event of the rules engine leads to. */
export class ConversionError extends Error {
  constructor(
    readonly round: number,
    message: string
  ) {
    super(`Snapshot ${round}: ${message}`)
    this.name = "ConversionError"
  }
}

/**
 * The Events that lead from the first snapshot through every following one.
 * Throws a `ConversionError` at the first snapshot the rules engine cannot
 * reach in one step.
 */
export function convertGame(
  rounds: ReadonlyArray<OldRound>,
  ruleSet: RuleSet = OLD_RULE_SET
): ConvertedGame {
  const sorted = rounds.map(cleaned).sort((a, b) => a.round - b.round)
  if (sorted.length === 0) throw new ConversionError(0, "no snapshots")
  const [start, ...rest] = sorted
  const seating = seatingOf(start)
  let state = replay(ruleSet, seating, [])
  check(start, state)

  const events: Array<GameEvent> = []
  for (const next of rest) {
    const event = eventBetween(state, ruleSet, next)
    const step = preview(state, ruleSet, event)
    if (!step.ok) {
      throw new ConversionError(
        next.round,
        `${event.type} is not allowed (${step.reason.code})`
      )
    }
    state = step.state
    check(next, state)
    events.push(event)
  }
  return { seating, events }
}

/** What an old snapshot says, in a form two snapshots can be compared by. */
export type SnapshotView = {
  /** Sorted by id. */
  lives: Array<[id: string, lives: number]>
  swimmer: string | null
  /** Null where it was not recorded, and once the Game is over. */
  dealer: string | null
  bombBy: string | null
}

/** A stored snapshot as a `SnapshotView` (negative Lives as 0, see `cleaned`). */
export function viewOf(round: OldRound, over: boolean): SnapshotView {
  const { data } = cleaned(round)
  return {
    lives: data.players
      .map((p): [string, number] => [p.id, p.lifes])
      .sort(([a], [b]) => a.localeCompare(b)),
    swimmer: data.playerSwimming ?? null,
    dealer: over || !data.dealer ? null : data.dealer,
    bombBy: data.nukeBy ?? null,
  }
}

/**
 * What replaying the Events gives after each of them (and at the start), as
 * `SnapshotView`s: the round trip compares them with the stored snapshots.
 * `withDealer: false` leaves the Dealer out, for Games that did not record it.
 */
export function replayAsViews(
  converted: ConvertedGame,
  { withDealer = true }: { withDealer?: boolean } = {},
  ruleSet: RuleSet = OLD_RULE_SET
): Array<SnapshotView> {
  return [undefined, ...converted.events].map((event, index) => {
    const state = replay(
      ruleSet,
      converted.seating,
      converted.events.slice(0, index)
    )
    return {
      lives: state.participants
        .map((p): [string, number] => [p.id, p.lives])
        .sort(([a], [b]) => a.localeCompare(b)),
      swimmer: state.swimmer,
      dealer: withDealer && !state.finished ? state.dealer : null,
      bombBy: event?.type === "bomb" ? event.thrower : null,
    }
  })
}

/**
 * The snapshot as the old app meant it. An early version (May 2025) let a
 * Bomb take Lives from Participants already Out, down to -1 and -2; Out is
 * 0 Lives, whatever it says.
 */
function cleaned(round: OldRound): OldRound {
  if (round.data.players.every((p) => p.lifes >= 0)) return round
  return {
    ...round,
    data: {
      ...round.data,
      players: round.data.players.map((p) => ({
        ...p,
        lifes: Math.max(0, p.lifes),
      })),
    },
  }
}

/**
 * The Seating Order: the old `order`, turned so that the first Dealer sits
 * at seat 0 as in the new model (who sits next to whom stays the same).
 * Without a recorded Dealer, the old order as it is.
 */
function seatingOf(start: OldRound): Array<string> {
  const ordered = [...start.data.players]
    .sort((a, b) => a.order - b.order)
    .map((p) => p.id)
  if (start.data.dealer === undefined) return ordered
  const first = ordered.indexOf(start.data.dealer)
  if (first === -1) {
    throw new ConversionError(start.round, "the Dealer does not take part")
  }
  return [...ordered.slice(first), ...ordered.slice(0, first)]
}

/** Which Event turns `state` into the snapshot `next`. */
function eventBetween(
  state: GameState,
  ruleSet: RuleSet,
  next: OldRound
): GameEvent {
  const { data } = next
  const lives = new Map(data.players.map((p) => [p.id, p.lifes]))
  const swimmer = data.playerSwimming ?? null
  const becameSwimmer =
    swimmer !== null && swimmer !== state.swimmer ? swimmer : null

  if (data.nukeBy) {
    const bomb: GameEvent = { type: "bomb", thrower: data.nukeBy }
    const plain = validate(state, ruleSet, bomb)
    // The new app names the Swimmer only when several could become it.
    if (!plain.ok && plain.reason.code === "swimmerChoiceRequired") {
      if (becameSwimmer === null) {
        throw new ConversionError(next.round, "Bomb without a Swimmer chosen")
      }
      return { ...bomb, swimmer: becameSwimmer }
    }
    return bomb
  }

  const hit = state.participants.filter(
    (p) => (lives.get(p.id) ?? p.lives) < p.lives || p.id === becameSwimmer
  )
  if (hit.length !== 1) {
    throw new ConversionError(
      next.round,
      `expected one Participant to lose, found ${hit.length}`
    )
  }
  return { type: "lost", loser: hit[0].id }
}

/** Throws unless `state` shows exactly what the snapshot recorded. */
function check(round: OldRound, state: GameState) {
  const expected = state.participants.map((p) => ({ id: p.id, lifes: p.lives }))
  for (const { id, lifes } of expected) {
    const stored = round.data.players.find((p) => p.id === id)
    if (stored?.lifes !== lifes) {
      throw new ConversionError(
        round.round,
        `Lives of ${id}: stored ${stored?.lifes}, replayed ${lifes}`
      )
    }
  }
  if (round.data.players.length !== expected.length) {
    throw new ConversionError(round.round, "Participants differ")
  }
  if ((round.data.playerSwimming ?? null) !== state.swimmer) {
    throw new ConversionError(
      round.round,
      `Swimmer: stored ${round.data.playerSwimming}, replayed ${state.swimmer}`
    )
  }
  // Not recorded in the first Games; and the old app leaves it empty once
  // the Game is over.
  const dealer = round.data.dealer
  if (dealer !== undefined && !state.finished && dealer !== state.dealer) {
    throw new ConversionError(
      round.round,
      `Dealer: stored ${round.data.dealer}, replayed ${state.dealer}`
    )
  }
}
