import { describe, expect, it } from "vitest"
import { replay } from "@/rules-engine"
import {
  ConversionError,
  OLD_RULE_SET,
  convertGame,
  replayAsViews,
  viewOf,
} from "./convert-game"
import fixtures from "./fixtures/old-games.json"
import type { OldRound, OldSnapshot } from "./convert-game"

// Real Games of the old app, anonymised: Participants are p1, p2, … by their
// old order; only Lives, Swimmer, Dealer and Bombs are left.
type Fixture = {
  description: string
  status: "COMPLETED" | "CANCELLED"
  winner: string | null
  rounds: Array<OldRound>
}

describe("round trip with real Games of the old app", () => {
  it.each(fixtures as Array<Fixture>)("$description", (fixture) => {
    const converted = convertGame(fixture.rounds)
    const withDealer = fixture.rounds[0].data.dealer !== undefined
    const replayed = replayAsViews(converted, { withDealer })
    const last = fixture.rounds.length - 1

    expect(replayed).toEqual(
      fixture.rounds.map((round, index) =>
        viewOf(round, index === last && fixture.status === "COMPLETED")
      )
    )
    const end = replay(OLD_RULE_SET, converted.seating, converted.events)
    expect(end.finished).toBe(fixture.status === "COMPLETED")
    expect(end.winner).toBe(fixture.winner)
  })
})

/** A snapshot of players p1… with these Lives, in that order. */
function snapshot(
  round: number,
  lives: Array<number>,
  rest: Partial<OldSnapshot> = {}
): OldRound {
  return {
    round,
    data: {
      players: lives.map((lifes, index) => ({
        id: `p${index + 1}`,
        lifes,
        order: index,
      })),
      ...rest,
    },
  }
}

describe("convertGame", () => {
  it("records a lost Life as `lost`, and the next Dealer follows", () => {
    expect(
      convertGame([
        snapshot(0, [3, 3, 3], { dealer: "p1" }),
        snapshot(1, [3, 2, 3], { dealer: "p2" }),
      ])
    ).toEqual({
      seating: ["p1", "p2", "p3"],
      events: [{ type: "lost", loser: "p2" }],
    })
  })

  it("seats the first Dealer at seat 0, keeping who sits next to whom", () => {
    const { seating } = convertGame([
      snapshot(0, [3, 3, 3, 3], { dealer: "p3" }),
    ])

    expect(seating).toEqual(["p3", "p4", "p1", "p2"])
  })

  it("names the Swimmer of a Bomb only when several could become it", () => {
    // Without a recorded Dealer, as in the first Games, to keep it short.
    const start = [
      snapshot(0, [3, 3, 3]),
      snapshot(1, [3, 2, 3]),
      snapshot(2, [3, 1, 3]),
    ]

    const single = convertGame([
      ...start,
      snapshot(3, [3, 1, 2], { nukeBy: "p1", playerSwimming: "p2" }),
    ])
    const conflict = convertGame([
      ...start,
      snapshot(3, [3, 1, 2]),
      snapshot(4, [3, 1, 1]),
      snapshot(5, [3, 1, 0], { nukeBy: "p1", playerSwimming: "p2" }),
    ])

    expect(single.events.at(-1)).toEqual({ type: "bomb", thrower: "p1" })
    expect(conflict.events.at(-1)).toEqual({
      type: "bomb",
      thrower: "p1",
      swimmer: "p2",
    })
  })

  it("rejects a snapshot that no single Event leads to", () => {
    expect(() =>
      convertGame([
        snapshot(0, [3, 3, 3], { dealer: "p1" }),
        snapshot(1, [2, 2, 3], { dealer: "p2" }),
      ])
    ).toThrow(ConversionError)
    expect(() =>
      convertGame([
        snapshot(0, [3, 3, 3], { dealer: "p1" }),
        snapshot(1, [3, 2, 3], { dealer: "p3" }),
      ])
    ).toThrow(/Dealer/)
  })
})
