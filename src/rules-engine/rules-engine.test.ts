import { describe, expect, it } from "vitest"
import {
  preview,
  replay,
  standardRuleSet,
  validate,
  validateSeatingOrder,
} from "@/rules-engine"
import type { GameEvent, GameState } from "@/rules-engine"

describe("a new Game", () => {
  it("starts everyone with 3 Lives and the first in the Seating Order as Dealer", () => {
    const state = replay(standardRuleSet, ["Anna", "Ben", "Carla"], [])

    expect(state.participants).toEqual([
      { id: "Anna", lives: 3, status: "in" },
      { id: "Ben", lives: 3, status: "in" },
      { id: "Carla", lives: 3, status: "in" },
    ])
    expect(state.dealer).toBe("Anna")
    expect(state.round).toBe(1)
    expect(state.swimmer).toBeNull()
    expect(state.winner).toBeNull()
    expect(state.finished).toBe(false)
  })
})

describe("the Seating Order", () => {
  const nine = ["A", "B", "C", "D", "E", "F", "G", "H", "I"]

  it("allows 2 to 9 Participants under the Standard Rule Set", () => {
    expect(validateSeatingOrder(standardRuleSet, ["Anna", "Ben"])).toEqual({
      ok: true,
    })
    expect(validateSeatingOrder(standardRuleSet, nine)).toEqual({ ok: true })
  })

  it.each([
    {
      case: "fewer than 2",
      seating: ["Anna"],
      reason: { code: "tooFewParticipants", min: 2 },
    },
    {
      case: "more than 9",
      seating: [...nine, "J"],
      reason: { code: "tooManyParticipants", max: 9 },
    },
    {
      case: "a player twice",
      seating: ["Anna", "Ben", "Anna"],
      reason: { code: "duplicateParticipant", participant: "Anna" },
    },
  ])("rejects $case", ({ seating, reason }) => {
    expect(validateSeatingOrder(standardRuleSet, seating)).toEqual({
      ok: false,
      reason,
    })
  })

  it("follows the Rule Set's limits", () => {
    const smallTable = {
      ...standardRuleSet,
      minParticipants: 3,
      maxParticipants: 4,
    }

    expect(validateSeatingOrder(smallTable, ["Anna", "Ben"])).toEqual({
      ok: false,
      reason: { code: "tooFewParticipants", min: 3 },
    })
    expect(
      validateSeatingOrder(smallTable, ["Anna", "Ben", "Carla", "Dario"])
    ).toEqual({ ok: true })
  })

  it("makes replay refuse to start a Game with an invalid Seating Order", () => {
    expect(() => replay(standardRuleSet, ["Anna"], [])).toThrow(
      expect.objectContaining({
        name: "InvalidSeatingOrderError",
        reason: { code: "tooFewParticipants", min: 2 },
      })
    )
  })
})

describe("other starting Lives", () => {
  it("start everyone with the Rule Set's Lives", () => {
    const state = replay(
      { ...standardRuleSet, startingLives: 5 },
      ["Anna", "Ben"],
      []
    )

    expect(livesOf(state)).toEqual({ Anna: 5, Ben: 5 })
  })

  it("with a single Life make the first loser the Swimmer", () => {
    const oneLife = { ...standardRuleSet, startingLives: 1 }
    const state = replay(
      oneLife,
      ["Anna", "Ben", "Carla"],
      [lost("Ben"), lost("Carla")]
    )

    expect(statusOf(state)).toEqual({
      Anna: "in",
      Ben: "swimming",
      Carla: "out",
    })
  })
})

describe("losing a Round", () => {
  it("costs the loser a Life, passes the Dealer on and starts the next Round", () => {
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla"],
      [{ type: "lost", loser: "Ben" }]
    )

    expect(livesOf(state)).toEqual({ Anna: 3, Ben: 2, Carla: 3 })
    expect(state.dealer).toBe("Ben")
    expect(state.round).toBe(2)
  })
})

describe("the Swimmer", () => {
  it("is whoever would lose their last Life first, and keeps playing on it", () => {
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla"],
      [...times(3, lost("Ben"))]
    )

    expect(state.swimmer).toBe("Ben")
    expect(statusOf(state)).toEqual({
      Anna: "in",
      Ben: "swimming",
      Carla: "in",
    })
    expect(livesOf(state).Ben).toBe(1)
  })

  it("is out when losing again", () => {
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla"],
      [...times(4, lost("Ben"))]
    )

    expect(statusOf(state).Ben).toBe("out")
    expect(livesOf(state).Ben).toBe(0)
    expect(state.swimmer).toBe("Ben")
  })

  it("exists only once per Game: the next one losing their last Life is out, even after the Swimmer is out", () => {
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla", "Dario"],
      [...times(4, lost("Ben")), ...times(3, lost("Carla"))]
    )

    expect(statusOf(state)).toEqual({
      Anna: "in",
      Ben: "out",
      Carla: "out",
      Dario: "in",
    })
    expect(state.swimmer).toBe("Ben")
  })

  it("does not exist when the Rule Set turns it off", () => {
    const state = replay(
      { ...standardRuleSet, swimmer: false },
      ["Anna", "Ben", "Carla"],
      times(3, lost("Ben"))
    )

    expect(statusOf(state).Ben).toBe("out")
    expect(state.swimmer).toBeNull()
  })
})

describe("the Dealer", () => {
  it("passes clockwise to the next remaining player, skipping those who are out", () => {
    // Dealers: Anna, Ben, Carla, Anna. Ben is out after Round 4, so Carla
    // deals Round 5 instead of him.
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla"],
      [...times(4, lost("Ben"))]
    )

    expect(statusOf(state).Ben).toBe("out")
    expect(state.dealer).toBe("Carla")
  })

  it("passes on as usual when the Dealer is out in the Round they dealt", () => {
    // Dealers: Anna, Ben, Carla, Anna, Ben. Ben is out in Round 5, which he
    // dealt, so Carla deals Round 6.
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla"],
      [...times(3, lost("Ben")), lost("Anna"), lost("Ben")]
    )

    expect(statusOf(state).Ben).toBe("out")
    expect(state.dealer).toBe("Carla")
  })
})

describe("the end of a Game", () => {
  it("comes when exactly one player is left, who is the Winner", () => {
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla"],
      [
        ...times(4, lost("Ben")), // Swimmer, then out
        ...times(3, lost("Carla")), // out, there was already a Swimmer
      ]
    )

    expect(state.finished).toBe(true)
    expect(state.winner).toBe("Anna")
  })

  it("records the order players went out in", () => {
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla"],
      [
        ...times(3, lost("Carla")), // Carla swims
        ...times(3, lost("Ben")), // Ben out in Round 6
        lost("Carla"), // Carla out in Round 7
      ]
    )

    expect(state.outOrder).toEqual([["Ben"], ["Carla"]])
  })
})

describe("a Bomb", () => {
  const seating = ["Anna", "Ben", "Carla", "Dario"]

  it("costs every other remaining player a Life and ends the Round", () => {
    const state = replay(standardRuleSet, seating, [bomb("Carla")])

    expect(livesOf(state)).toEqual({ Anna: 2, Ben: 2, Carla: 3, Dario: 2 })
    expect(state.dealer).toBe("Ben")
    expect(state.round).toBe(2)
  })

  it("makes the only player it would put out the Swimmer, without a choice", () => {
    const state = replay(standardRuleSet, seating, [
      ...times(2, lost("Ben")),
      bomb("Carla"),
    ])

    expect(state.swimmer).toBe("Ben")
    expect(statusOf(state).Ben).toBe("swimming")
    expect(livesOf(state)).toEqual({ Anna: 2, Ben: 1, Carla: 3, Dario: 2 })
  })

  it("needs a Swimmer choice when it would put out several players and nobody has swum yet", () => {
    const state = replay(standardRuleSet, seating, [
      ...times(2, lost("Ben")),
      ...times(2, lost("Dario")),
    ])

    expect(validate(state, standardRuleSet, bomb("Carla"))).toEqual({
      ok: false,
      reason: { code: "swimmerChoiceRequired", candidates: ["Ben", "Dario"] },
    })
  })

  it("makes the chosen player the Swimmer and puts the others out", () => {
    const state = replay(standardRuleSet, seating, [
      ...times(2, lost("Ben")),
      ...times(2, lost("Dario")),
      bomb("Carla", { swimmer: "Dario" }),
    ])

    expect(state.swimmer).toBe("Dario")
    expect(statusOf(state)).toEqual({
      Anna: "in",
      Ben: "out",
      Carla: "in",
      Dario: "swimming",
    })
    expect(state.outOrder).toEqual([["Ben"]])
  })

  it("rejects a Swimmer choice of a player it would not put out", () => {
    const state = replay(standardRuleSet, seating, [
      ...times(2, lost("Ben")),
      ...times(2, lost("Dario")),
    ])

    expect(
      validate(state, standardRuleSet, bomb("Carla", { swimmer: "Anna" }))
    ).toEqual({
      ok: false,
      reason: {
        code: "invalidSwimmerChoice",
        participant: "Anna",
        candidates: ["Ben", "Dario"],
      },
    })
  })

  it("rejects a Swimmer choice when there is nobody to choose from", () => {
    const state = replay(standardRuleSet, seating, [])

    expect(
      validate(state, standardRuleSet, bomb("Carla", { swimmer: "Ben" }))
    ).toEqual({
      ok: false,
      reason: {
        code: "invalidSwimmerChoice",
        participant: "Ben",
        candidates: [],
      },
    })
  })

  it("puts out the Swimmer and everyone else on their last Life once someone has swum", () => {
    const state = replay(standardRuleSet, seating, [
      ...times(3, lost("Ben")), // Ben swims
      ...times(2, lost("Dario")),
      bomb("Carla"),
    ])

    expect(statusOf(state)).toEqual({
      Anna: "in",
      Ben: "out",
      Carla: "in",
      Dario: "out",
    })
    expect(state.outOrder).toEqual([["Ben", "Dario"]])
  })

  it("wins the Game for the thrower when nobody else is left", () => {
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla"],
      [
        ...times(3, lost("Ben")), // Ben swims
        ...times(2, lost("Carla")),
        bomb("Anna"),
      ]
    )

    expect(state.finished).toBe(true)
    expect(state.winner).toBe("Anna")
    expect(state.outOrder).toEqual([["Ben", "Carla"]])
  })

  it("may be thrown by the Swimmer", () => {
    const state = replay(standardRuleSet, seating, [
      ...times(3, lost("Ben")),
      bomb("Ben"),
    ])

    expect(livesOf(state)).toEqual({ Anna: 2, Ben: 1, Carla: 2, Dario: 2 })
    expect(statusOf(state).Ben).toBe("swimming")
  })

  it("is rejected when thrown by a player who is out", () => {
    const state = replay(standardRuleSet, seating, times(4, lost("Ben")))

    expect(validate(state, standardRuleSet, bomb("Ben"))).toEqual({
      ok: false,
      reason: { code: "participantOut", participant: "Ben" },
    })
  })

  it("is rejected when the Rule Set has no Bombs", () => {
    const noBombs = { ...standardRuleSet, bomb: false }
    const state = replay(noBombs, seating, [])

    expect(validate(state, noBombs, bomb("Carla"))).toEqual({
      ok: false,
      reason: { code: "bombsDisabled" },
    })
  })

  it("puts out everyone on their last Life when the Rule Set has no Swimmer", () => {
    const noSwimmer = { ...standardRuleSet, swimmer: false }
    const state = replay(noSwimmer, seating, [
      ...times(2, lost("Ben")),
      ...times(2, lost("Dario")),
      bomb("Carla"),
    ])

    expect(state.outOrder).toEqual([["Ben", "Dario"]])
    expect(state.swimmer).toBeNull()
  })
})

describe("a Tiebreak", () => {
  const seating = ["Anna", "Ben", "Carla", "Dario"]

  it("may be recorded with a lost Round and changes nothing else about it", () => {
    const withTiebreak = replay(standardRuleSet, seating, [
      lost("Ben", { tiebreak: ["Ben", "Dario"] }),
    ])
    const without = replay(standardRuleSet, seating, [lost("Ben")])

    expect(withTiebreak).toEqual(without)
  })

  it.each([
    {
      case: "with fewer than two players in it",
      tiebreak: ["Ben"],
      reason: { code: "tiebreakNeedsTwoParticipants" },
    },
    {
      case: "without the loser in it",
      tiebreak: ["Anna", "Dario"],
      reason: { code: "tiebreakWithoutLoser" },
    },
    {
      case: "with a player twice",
      tiebreak: ["Ben", "Ben"],
      reason: { code: "tiebreakDuplicateParticipant", participant: "Ben" },
    },
    {
      case: "with someone who is not a Participant",
      tiebreak: ["Ben", "Zoe"],
      reason: { code: "unknownParticipant", participant: "Zoe" },
    },
  ])("is rejected $case", ({ tiebreak, reason }) => {
    const state = replay(standardRuleSet, seating, [])

    expect(validate(state, standardRuleSet, lost("Ben", { tiebreak }))).toEqual(
      {
        ok: false,
        reason,
      }
    )
  })

  it("is rejected with a player who is out", () => {
    const state = replay(standardRuleSet, seating, times(4, lost("Carla")))

    expect(
      validate(
        state,
        standardRuleSet,
        lost("Ben", { tiebreak: ["Ben", "Carla"] })
      )
    ).toEqual({
      ok: false,
      reason: { code: "participantOut", participant: "Carla" },
    })
  })

  it("is rejected when only two players remain, since they play an Extra Round instead", () => {
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla"],
      times(4, lost("Carla"))
    )

    expect(
      validate(
        state,
        standardRuleSet,
        lost("Ben", { tiebreak: ["Anna", "Ben"] })
      )
    ).toEqual({
      ok: false,
      reason: { code: "tiebreakNeedsMoreThanTwoRemaining" },
    })
  })
})

describe("an Extra Round", () => {
  // Ben is out after Round 4 (Swimmer, then lost again); Anna and Carla remain
  // and Carla deals Round 5.
  const twoLeft = [...times(4, lost("Ben"))]

  it("keeps the Dealer, the Round number and everyone's Lives when the last two tie", () => {
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla"],
      [...twoLeft, extraRound, extraRound]
    )

    expect(state).toEqual(
      replay(standardRuleSet, ["Anna", "Ben", "Carla"], twoLeft)
    )
    expect(state.dealer).toBe("Carla")
    expect(state.round).toBe(5)
  })

  it("is over once one of the two loses the Round, and the Dealer passes on", () => {
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla"],
      [...twoLeft, extraRound, lost("Anna")]
    )

    expect(state.round).toBe(6)
    expect(state.dealer).toBe("Anna")
  })

  it("is rejected unless exactly two players remain", () => {
    const state = replay(standardRuleSet, ["Anna", "Ben", "Carla"], [])

    expect(validate(state, standardRuleSet, extraRound)).toEqual({
      ok: false,
      reason: { code: "extraRoundNeedsTwoRemaining" },
    })
  })
})

describe("previewing an Event", () => {
  const seating = ["Anna", "Ben", "Carla"]

  it("shows the Winner before the last Event is recorded", () => {
    const events = [...times(4, lost("Ben")), ...times(2, lost("Carla"))]
    const state = replay(standardRuleSet, seating, events)

    const result = preview(state, standardRuleSet, lost("Carla"))

    expect(result).toEqual({
      ok: true,
      effects: {
        lostLife: ["Carla"],
        becameSwimmer: null,
        out: ["Carla"],
        winner: "Anna",
      },
      state: replay(standardRuleSet, seating, [...events, lost("Carla")]),
    })
  })

  it("shows who a Bomb hits and who swims", () => {
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla", "Dario"],
      [...times(2, lost("Ben"))]
    )

    const result = preview(state, standardRuleSet, bomb("Carla"))

    expect(result).toMatchObject({
      ok: true,
      effects: {
        lostLife: ["Anna", "Dario"],
        becameSwimmer: "Ben",
        out: [],
        winner: null,
      },
    })
  })

  it("names the candidates when a Bomb needs a Swimmer choice", () => {
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben", "Carla", "Dario"],
      [...times(2, lost("Ben")), ...times(2, lost("Dario"))]
    )

    expect(preview(state, standardRuleSet, bomb("Carla"))).toEqual({
      ok: false,
      reason: { code: "swimmerChoiceRequired", candidates: ["Ben", "Dario"] },
    })
  })
})

describe("undo", () => {
  it("is a replay without the last Event, whatever that Event did", () => {
    const seating = ["Anna", "Ben", "Carla"]
    const events = [
      ...times(3, lost("Ben")),
      bomb("Anna"), // Ben out, Carla down to 2
      ...times(2, lost("Carla")), // Carla out, Anna wins
    ]
    const finished = replay(standardRuleSet, seating, events)
    expect(finished.finished).toBe(true)

    const undone = replay(standardRuleSet, seating, events.slice(0, -1))

    expect(undone.finished).toBe(false)
    expect(undone.winner).toBeNull()
    expect(livesOf(undone)).toEqual({ Anna: 3, Ben: 0, Carla: 1 })
    expect(undone.round).toBe(finished.round)
  })
})

describe("validating an Event", () => {
  const seating = ["Anna", "Ben", "Carla"]

  it("accepts a Round lost by a remaining player", () => {
    const state = replay(standardRuleSet, seating, [])

    expect(validate(state, standardRuleSet, lost("Ben"))).toEqual({ ok: true })
  })

  it("rejects a Round lost by a player who is out", () => {
    const state = replay(standardRuleSet, seating, times(4, lost("Ben")))

    expect(validate(state, standardRuleSet, lost("Ben"))).toEqual({
      ok: false,
      reason: { code: "participantOut", participant: "Ben" },
    })
  })

  it("rejects a player who is not a Participant", () => {
    const state = replay(standardRuleSet, seating, [])

    expect(validate(state, standardRuleSet, lost("Zoe"))).toEqual({
      ok: false,
      reason: { code: "unknownParticipant", participant: "Zoe" },
    })
  })

  it("rejects any Event once the Game has a Winner", () => {
    const state = replay(
      standardRuleSet,
      ["Anna", "Ben"],
      times(4, lost("Ben"))
    )

    expect(validate(state, standardRuleSet, lost("Anna"))).toEqual({
      ok: false,
      reason: { code: "gameFinished" },
    })
  })

  it("makes replay refuse an invalid Event log, naming the Event and the reason", () => {
    expect(() =>
      replay(standardRuleSet, seating, [...times(4, lost("Ben")), lost("Ben")])
    ).toThrow(
      expect.objectContaining({
        name: "InvalidEventError",
        index: 4,
        reason: { code: "participantOut", participant: "Ben" },
      })
    )
  })
})

function lost(
  player: string,
  options: { tiebreak?: string[] } = {}
): GameEvent {
  return { type: "lost", loser: player, ...options }
}

function bomb(thrower: string, options: { swimmer?: string } = {}): GameEvent {
  return { type: "bomb", thrower, ...options }
}

const extraRound: GameEvent = { type: "extraRound" }

function times<T>(n: number, item: T): Array<T> {
  return Array.from({ length: n }, () => item)
}

function statusOf(state: GameState) {
  return Object.fromEntries(state.participants.map((p) => [p.id, p.status]))
}

function livesOf(state: GameState) {
  return Object.fromEntries(state.participants.map((p) => [p.id, p.lives]))
}
