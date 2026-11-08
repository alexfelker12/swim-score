export type ParticipantId = string

export type RuleSet = {
  minParticipants: number
  maxParticipants: number
  startingLives: number
  bomb: boolean
  swimmer: boolean
}

export const standardRuleSet: RuleSet = {
  minParticipants: 2,
  maxParticipants: 9,
  startingLives: 3,
  bomb: true,
  swimmer: true,
}

export type ParticipantState = {
  id: ParticipantId
  lives: number
  status: "in" | "swimming" | "out"
}

export type GameState = {
  participants: Array<ParticipantState>
  dealer: ParticipantId
  round: number
  swimmer: ParticipantId | null
  /** Who went Out, Round by Round; those Out in the same Round share an entry. */
  outOrder: Array<Array<ParticipantId>>
  winner: ParticipantId | null
  finished: boolean
}

export type GameEvent =
  | {
      type: "lost"
      loser: ParticipantId
      /** The players in the Tiebreak that decided the Round, the loser included. */
      tiebreak?: Array<ParticipantId>
    }
  | {
      type: "bomb"
      thrower: ParticipantId
      /** Who becomes the Swimmer when the Bomb would put out several players. */
      swimmer?: ParticipantId
    }
  | { type: "extraRound" }

export type Rejection =
  | { code: "gameFinished" }
  | { code: "unknownParticipant"; participant: ParticipantId }
  | { code: "participantOut"; participant: ParticipantId }
  | { code: "bombsDisabled" }
  | { code: "extraRoundNeedsTwoRemaining" }
  | { code: "tiebreakNeedsMoreThanTwoRemaining" }
  | { code: "tiebreakNeedsTwoParticipants" }
  | { code: "tiebreakWithoutLoser" }
  | { code: "tiebreakDuplicateParticipant"; participant: ParticipantId }
  | { code: "swimmerChoiceRequired"; candidates: Array<ParticipantId> }
  | {
      code: "invalidSwimmerChoice"
      participant: ParticipantId
      candidates: Array<ParticipantId>
    }

export type Validation = { ok: true } | { ok: false; reason: Rejection }

export type SeatingOrderRejection =
  | { code: "tooFewParticipants"; min: number }
  | { code: "tooManyParticipants"; max: number }
  | { code: "duplicateParticipant"; participant: ParticipantId }

export type SeatingOrderValidation =
  { ok: true } | { ok: false; reason: SeatingOrderRejection }

/** Whether a Game may start with these Participants in this order. */
export function validateSeatingOrder(
  ruleSet: RuleSet,
  seatingOrder: ReadonlyArray<ParticipantId>
): SeatingOrderValidation {
  const duplicate = seatingOrder.find((id, i) => seatingOrder.indexOf(id) !== i)
  if (duplicate !== undefined) {
    return {
      ok: false,
      reason: { code: "duplicateParticipant", participant: duplicate },
    }
  }
  if (seatingOrder.length < ruleSet.minParticipants) {
    return {
      ok: false,
      reason: { code: "tooFewParticipants", min: ruleSet.minParticipants },
    }
  }
  if (seatingOrder.length > ruleSet.maxParticipants) {
    return {
      ok: false,
      reason: { code: "tooManyParticipants", max: ruleSet.maxParticipants },
    }
  }
  return { ok: true }
}

/** Thrown by `replay` when the Seating Order breaks the Rule Set. */
export class InvalidSeatingOrderError extends Error {
  override name = "InvalidSeatingOrderError"

  constructor(readonly reason: SeatingOrderRejection) {
    super(`Seating Order is invalid: ${reason.code}`)
  }
}

/** Thrown by `replay` when a recorded Event breaks the rules. */
export class InvalidEventError extends Error {
  override name = "InvalidEventError"

  constructor(
    readonly index: number,
    readonly event: GameEvent,
    readonly reason: Rejection
  ) {
    super(`Event ${index} (${event.type}) is invalid: ${reason.code}`)
  }
}

/** Derives the Game's state by replaying its Events in order. */
export function replay(
  ruleSet: RuleSet,
  seatingOrder: ReadonlyArray<ParticipantId>,
  events: ReadonlyArray<GameEvent>
): GameState {
  const seating = validateSeatingOrder(ruleSet, seatingOrder)
  if (!seating.ok) throw new InvalidSeatingOrderError(seating.reason)
  return events.reduce(
    (state, event, index) => {
      const validation = validate(state, ruleSet, event)
      if (!validation.ok) {
        throw new InvalidEventError(index, event, validation.reason)
      }
      return apply(state, ruleSet, event)
    },
    initialState(ruleSet, seatingOrder)
  )
}

export type Effects = {
  /** Who loses a Life, including those who go Out by it. */
  lostLife: Array<ParticipantId>
  becameSwimmer: ParticipantId | null
  out: Array<ParticipantId>
  winner: ParticipantId | null
}

export type Preview =
  | { ok: true; effects: Effects; state: GameState }
  | { ok: false; reason: Rejection }

/** What recording the Event next would do, without recording it. */
export function preview(
  state: GameState,
  ruleSet: RuleSet,
  event: GameEvent
): Preview {
  const validation = validate(state, ruleSet, event)
  if (!validation.ok) return validation
  const next = apply(state, ruleSet, event)
  const before = new Map(state.participants.map((p) => [p.id, p]))
  return {
    ok: true,
    effects: {
      lostLife: next.participants
        .filter((p) => p.lives < before.get(p.id)!.lives)
        .map((p) => p.id),
      becameSwimmer: next.swimmer !== state.swimmer ? next.swimmer : null,
      out: next.participants
        .filter((p) => p.status === "out" && before.get(p.id)!.status !== "out")
        .map((p) => p.id),
      winner: next.winner,
    },
    state: next,
  }
}

/** Whether the Event may be recorded next, and if not, why. */
export function validate(
  state: GameState,
  ruleSet: RuleSet,
  event: GameEvent
): Validation {
  if (state.finished) return reject({ code: "gameFinished" })
  switch (event.type) {
    case "lost": {
      const rejection =
        checkRemaining(state, event.loser) ??
        (event.tiebreak
          ? checkTiebreak(state, event.loser, event.tiebreak)
          : null)
      return rejection ? reject(rejection) : { ok: true }
    }
    case "bomb": {
      if (!ruleSet.bomb) return reject({ code: "bombsDisabled" })
      const rejection = checkRemaining(state, event.thrower)
      if (rejection) return reject(rejection)
      const candidates = swimmerCandidates(state, ruleSet, event.thrower)
      if (event.swimmer !== undefined && !candidates.includes(event.swimmer)) {
        return reject({
          code: "invalidSwimmerChoice",
          participant: event.swimmer,
          candidates,
        })
      }
      if (event.swimmer === undefined && candidates.length > 1) {
        return reject({ code: "swimmerChoiceRequired", candidates })
      }
      return { ok: true }
    }
    case "extraRound":
      return remaining(state).length === 2
        ? { ok: true }
        : reject({ code: "extraRoundNeedsTwoRemaining" })
  }
}

function checkTiebreak(
  state: GameState,
  loser: ParticipantId,
  tiebreak: ReadonlyArray<ParticipantId>
): Rejection | null {
  if (remaining(state).length <= 2) {
    return { code: "tiebreakNeedsMoreThanTwoRemaining" }
  }
  for (const [index, participant] of tiebreak.entries()) {
    const rejection = checkRemaining(state, participant)
    if (rejection) return rejection
    if (tiebreak.indexOf(participant) !== index) {
      return { code: "tiebreakDuplicateParticipant", participant }
    }
  }
  if (tiebreak.length < 2) return { code: "tiebreakNeedsTwoParticipants" }
  if (!tiebreak.includes(loser)) return { code: "tiebreakWithoutLoser" }
  return null
}

function remaining(state: Pick<GameState, "participants">) {
  return state.participants.filter((p) => p.status !== "out")
}

/** Who a Bomb would put out and could become the Swimmer instead. */
function swimmerCandidates(
  state: GameState,
  ruleSet: RuleSet,
  thrower: ParticipantId
): Array<ParticipantId> {
  if (!ruleSet.swimmer || state.swimmer !== null) return []
  return state.participants
    .filter((p) => p.id !== thrower && p.status === "in" && p.lives === 1)
    .map((p) => p.id)
}

function checkRemaining(
  state: GameState,
  participant: ParticipantId
): Rejection | null {
  const found = state.participants.find((p) => p.id === participant)
  if (!found) return { code: "unknownParticipant", participant }
  if (found.status === "out") return { code: "participantOut", participant }
  return null
}

function reject(reason: Rejection): Validation {
  return { ok: false, reason }
}

function initialState(
  ruleSet: RuleSet,
  seatingOrder: ReadonlyArray<ParticipantId>
): GameState {
  return {
    participants: seatingOrder.map((id) => ({
      id,
      lives: ruleSet.startingLives,
      status: "in",
    })),
    dealer: seatingOrder[0],
    round: 1,
    swimmer: null,
    outOrder: [],
    winner: null,
    finished: false,
  }
}

function apply(
  state: GameState,
  ruleSet: RuleSet,
  event: GameEvent
): GameState {
  switch (event.type) {
    case "lost":
      return endRound(
        state,
        loseLives(state, ruleSet, [event.loser], undefined)
      )
    case "bomb": {
      const others = remaining(state)
        .map((p) => p.id)
        .filter((id) => id !== event.thrower)
      const candidates = swimmerCandidates(state, ruleSet, event.thrower)
      const swimmer =
        event.swimmer ?? (candidates.length === 1 ? candidates[0] : undefined)
      return endRound(state, loseLives(state, ruleSet, others, swimmer))
    }
    case "extraRound":
      // Re-dealt by the same Dealer within the same Round; recorded for
      // statistics only.
      return state
  }
}

function endRound(
  before: GameState,
  after: Pick<GameState, "participants" | "swimmer">
): GameState {
  const wentOut = after.participants
    .filter((p) => p.status === "out")
    .map((p) => p.id)
    .filter((id) => !before.outOrder.flat().includes(id))
  const stillIn = remaining(after)
  const finished = stillIn.length === 1
  return {
    ...before,
    ...after,
    outOrder:
      wentOut.length > 0 ? [...before.outOrder, wentOut] : before.outOrder,
    dealer: nextDealer(after.participants, before.dealer),
    round: finished ? before.round : before.round + 1,
    winner: finished ? stillIn[0].id : null,
    finished,
  }
}

function nextDealer(
  participants: ReadonlyArray<ParticipantState>,
  dealer: ParticipantId
): ParticipantId {
  const index = participants.findIndex((p) => p.id === dealer)
  for (let step = 1; step <= participants.length; step++) {
    const candidate = participants[(index + step) % participants.length]
    if (candidate.status !== "out") return candidate.id
  }
  return dealer
}

/**
 * Each losing Participant loses a Life. Whoever would lose their last Life becomes
 * the Swimmer instead, if the Rule Set has one and nobody has swum yet in
 * this Game; `swimmer` decides who when several are hit at once.
 */
function loseLives(
  state: Pick<GameState, "participants" | "swimmer">,
  ruleSet: RuleSet,
  losing: ReadonlyArray<ParticipantId>,
  swimmer: ParticipantId | undefined
): Pick<GameState, "participants" | "swimmer"> {
  let newSwimmer = state.swimmer
  const participants = state.participants.map((p): ParticipantState => {
    if (!losing.includes(p.id)) return p
    const canSwim = ruleSet.swimmer && newSwimmer === null && p.lives === 1
    if (canSwim && (swimmer === undefined || swimmer === p.id)) {
      newSwimmer = p.id
      return { ...p, status: "swimming" }
    }
    const lives = p.lives - 1
    return { ...p, lives, status: lives === 0 ? "out" : p.status }
  })
  return { participants, swimmer: newSwimmer }
}
