import { describe, expect, it } from "vitest"
import {
  addTiebreak,
  cancelGame,
  getGame,
  getNewGame,
  listGames,
  recordEvent,
  startGame,
  undoEvent,
} from "./games"
import { addGuest, createGroup, getGroup } from "./groups"
import { joinViaInvite } from "./testing/groups"
import { createTestApp, signUp } from "./testing/test-app"
import type { App } from "./app"
import type { GameEvent } from "@/rules-engine"

/** Anna's Group "Donnerstagsrunde" with Ben (account) and the Guests Carla and Dario. */
async function table() {
  const app = await createTestApp()
  const anna = await signUp(app.auth, { username: "Anna" })
  const ben = await signUp(app.auth, { username: "Ben" })
  const { id: groupId } = await createGroup(app, anna.headers, {
    name: "Donnerstagsrunde",
  })
  await joinViaInvite(app, groupId, ben.headers)
  await addGuest(app, anna.headers, { groupId, name: "Carla" })
  await addGuest(app, anna.headers, { groupId, name: "Dario" })
  const players = await playerIds(app, anna.headers, groupId)
  return { app, anna, ben, groupId, players }
}

async function playerIds(app: App, headers: Headers, groupId: string) {
  const group = await getGroup(app, headers, { groupId })
  return Object.fromEntries(group.players.map((p) => [p.name, p.id]))
}

/**
 * Anna, Ben, Carla. Anna bombs; Ben loses twice and swims; Carla loses
 * twice and is Out at once, since Ben already swam; Ben loses again: Anna wins.
 */
async function playedToTheEnd() {
  const setup = await table()
  const { app, anna, groupId, players } = setup
  const { id: gameId } = await startGame(app, anna.headers, {
    groupId,
    playerIds: [players.Anna, players.Ben, players.Carla],
  })
  const [annaP, benP, carlaP] = (await getGame(app, anna.headers, { gameId }))
    .participants
  const events = [
    { type: "bomb", thrower: annaP.id },
    { type: "lost", loser: benP.id },
    { type: "lost", loser: benP.id },
    { type: "lost", loser: carlaP.id },
    { type: "lost", loser: carlaP.id },
    { type: "lost", loser: benP.id },
  ] as const
  for (const [index, event] of events.entries()) {
    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: index,
      event,
    })
  }
  return { ...setup, gameId }
}

describe("starting a Game", () => {
  it("seats the Participants in the given order, makes the first the Dealer and the starter the Scorekeeper", async () => {
    const { app, anna, groupId, players } = await table()

    const { id } = await startGame(app, anna.headers, {
      groupId,
      playerIds: [players.Carla, players.Anna, players.Ben],
    })

    const game = await getGame(app, anna.headers, { gameId: id })
    expect(game).toMatchObject({
      id,
      groupId,
      groupName: "Donnerstagsrunde",
      status: "running",
      version: 0,
      scorekeeper: "Anna",
      isScorekeeper: true,
      events: [],
    })
    expect(game.participants.map((p) => [p.name, p.guest])).toEqual([
      ["Carla", true],
      ["Anna", false],
      ["Ben", false],
    ])
    const [carla] = game.participants
    expect(game.state).toMatchObject({
      round: 1,
      dealer: carla.id,
      finished: false,
    })
    expect(game.state.participants.map((p) => p.lives)).toEqual([3, 3, 3])
  })
})

describe("a Game's Participants", () => {
  it.each([
    { case: "fewer than 2", pick: ["Anna"], code: "tooFewParticipants" },
    {
      case: "the same Player twice",
      pick: ["Anna", "Ben", "Anna"],
      code: "duplicateParticipant",
    },
  ])("are refused when $case", async ({ pick, code }) => {
    const { app, anna, groupId, players } = await table()

    await expect(
      startGame(app, anna.headers, {
        groupId,
        playerIds: pick.map((name) => players[name]),
      })
    ).rejects.toMatchObject({ code })
  })

  it("are refused when more than 9", async () => {
    const { app, anna, groupId } = await table()
    for (const name of ["Emil", "Fiona", "Greta", "Hakan", "Ida", "Jonas"]) {
      await addGuest(app, anna.headers, { groupId, name })
    }
    const all = Object.values(await playerIds(app, anna.headers, groupId))
    expect(all).toHaveLength(10)

    await expect(
      startGame(app, anna.headers, { groupId, playerIds: all })
    ).rejects.toMatchObject({ code: "tooManyParticipants" })
  })

  it("must be Players of the Group", async () => {
    const { app, ben, players } = await table()
    const { id: other } = await createGroup(app, ben.headers, {
      name: "Andere",
    })
    const { id: lena } = await addGuest(app, ben.headers, {
      groupId: other,
      name: "Lena",
    })

    await expect(
      startGame(app, ben.headers, {
        groupId: other,
        playerIds: [lena, players.Anna],
      })
    ).rejects.toMatchObject({ code: "unknownPlayer" })
  })
})

describe("a Game is only for its Group's Players", () => {
  it("refuses an outsider starting or reading one, as if it did not exist", async () => {
    const { app, anna, groupId, players } = await table()
    const mallory = await signUp(app.auth, { username: "mallory" })
    const { id } = await startGame(app, anna.headers, {
      groupId,
      playerIds: [players.Anna, players.Ben],
    })

    await expect(
      startGame(app, mallory.headers, {
        groupId,
        playerIds: [players.Anna, players.Ben],
      })
    ).rejects.toMatchObject({ code: "groupNotFound" })
    await expect(
      getGame(app, mallory.headers, { gameId: id })
    ).rejects.toMatchObject({ code: "gameNotFound" })
    await expect(
      getGame(app, mallory.headers, { gameId: "does-not-exist" })
    ).rejects.toMatchObject({ code: "gameNotFound" })
  })
})

describe("recording an Event", () => {
  it("applies it to the Game and counts up the version", async () => {
    const { app, anna, groupId, players } = await table()
    const { id: gameId } = await startGame(app, anna.headers, {
      groupId,
      playerIds: [players.Anna, players.Ben, players.Carla],
    })
    const [, benP] = (await getGame(app, anna.headers, { gameId })).participants

    expect(
      await recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: 0,
        event: { type: "lost", loser: benP.id },
      })
    ).toEqual({ version: 1 })

    const game = await getGame(app, anna.headers, { gameId })
    expect(game.version).toBe(1)
    expect(game.events).toEqual([{ type: "lost", loser: benP.id }])
    expect(game.state.round).toBe(2)
    expect(game.state.dealer).toBe(benP.id)
    expect(game.state.participants.map((p) => [p.id, p.lives])).toContainEqual([
      benP.id,
      2,
    ])
  })
})

describe("only the Scorekeeper records", () => {
  it("refuses another Player of the Group and changes nothing", async () => {
    const { app, anna, ben, groupId, players } = await table()
    const { id: gameId } = await startGame(app, anna.headers, {
      groupId,
      playerIds: [players.Anna, players.Ben],
    })
    const [annaP] = (await getGame(app, ben.headers, { gameId })).participants

    await expect(
      recordEvent(app, ben.headers, {
        gameId,
        expectedVersion: 0,
        event: { type: "lost", loser: annaP.id },
      })
    ).rejects.toMatchObject({ code: "notScorekeeper" })
    const game = await getGame(app, ben.headers, { gameId })
    expect(game.isScorekeeper).toBe(false)
    expect(game.scorekeeper).toBe("Anna")
    expect(game.version).toBe(0)
  })

  it("refuses an outsider as if the Game did not exist", async () => {
    const { app, anna, groupId, players } = await table()
    const mallory = await signUp(app.auth, { username: "mallory" })
    const { id: gameId } = await startGame(app, anna.headers, {
      groupId,
      playerIds: [players.Anna, players.Ben],
    })

    await expect(
      recordEvent(app, mallory.headers, {
        gameId,
        expectedVersion: 0,
        event: { type: "extraRound" },
      })
    ).rejects.toMatchObject({ code: "gameNotFound" })
  })
})

describe("the expected version", () => {
  it("must be the Game's current one, so a device cannot record on top of a state it has not seen", async () => {
    const { app, anna, groupId, players } = await table()
    const { id: gameId } = await startGame(app, anna.headers, {
      groupId,
      playerIds: [players.Anna, players.Ben, players.Carla],
    })
    const [, benP, carlaP] = (await getGame(app, anna.headers, { gameId }))
      .participants
    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: 0,
      event: { type: "lost", loser: benP.id },
    })

    await expect(
      recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: 0,
        event: { type: "lost", loser: carlaP.id },
      })
    ).rejects.toMatchObject({ code: "versionConflict" })
    const game = await getGame(app, anna.headers, { gameId })
    expect(game.version).toBe(1)
    expect(game.events).toEqual([{ type: "lost", loser: benP.id }])
  })
})

describe("the rules", () => {
  it("refuse an Event that breaks them, and nothing changes", async () => {
    const { app, anna, groupId, players } = await table()
    const { id: gameId } = await startGame(app, anna.headers, {
      groupId,
      playerIds: [players.Anna, players.Ben, players.Carla],
    })

    await expect(
      recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: 0,
        event: { type: "lost", loser: "someone-else" },
      })
    ).rejects.toMatchObject({ code: "unknownParticipant" })
    expect((await getGame(app, anna.headers, { gameId })).version).toBe(0)
  })

  it("make the Scorekeeper choose the Swimmer when a Bomb would put out several", async () => {
    const { app, anna, groupId, players } = await table()
    const { id: gameId } = await startGame(app, anna.headers, {
      groupId,
      playerIds: [players.Anna, players.Ben, players.Carla],
    })
    const [annaP, benP, carlaP] = (await getGame(app, anna.headers, { gameId }))
      .participants
    let version = 0
    for (const loser of [benP, benP, carlaP, carlaP]) {
      ;({ version } = await recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: version,
        event: { type: "lost", loser: loser.id },
      }))
    }

    await expect(
      recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: version,
        event: { type: "bomb", thrower: annaP.id },
      })
    ).rejects.toMatchObject({ code: "swimmerChoiceRequired" })
    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: version,
      event: { type: "bomb", thrower: annaP.id, swimmer: carlaP.id },
    })

    const { state } = await getGame(app, anna.headers, { gameId })
    expect(state.swimmer).toBe(carlaP.id)
    expect(state.outOrder).toEqual([[benP.id]])
  })

  it.each([
    { case: "an unknown type", event: { type: "cheat" } },
    { case: "a loser that is not a string", event: { type: "lost", loser: 1 } },
    { case: "no Event at all", event: null },
  ])("refuse $case", async ({ event }) => {
    const { app, anna, groupId, players } = await table()
    const { id: gameId } = await startGame(app, anna.headers, {
      groupId,
      playerIds: [players.Anna, players.Ben],
    })

    await expect(
      recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: 0,
        event: event as never,
      })
    ).rejects.toMatchObject({ code: "invalidEvent" })
  })
})

describe("the end of a Game", () => {
  it("finishes the Game and writes each Participant's summary", async () => {
    const { app, anna, gameId } = await playedToTheEnd()

    const game = await getGame(app, anna.headers, { gameId })

    expect(game.status).toBe("finished")
    expect(game.finishedAt).toBeInstanceOf(Date)
    expect(
      game.participants.map(({ name, summary }) => ({ name, ...summary }))
    ).toEqual([
      {
        name: "Anna",
        won: true,
        swam: false,
        bombs: 1,
        livesLost: 0,
        outPosition: null,
      },
      {
        name: "Ben",
        won: false,
        swam: true,
        bombs: 0,
        livesLost: 4,
        outPosition: 2,
      },
      {
        name: "Carla",
        won: false,
        swam: false,
        bombs: 0,
        livesLost: 3,
        outPosition: 1,
      },
    ])
  })

  it("gives Participants Out in the same Round the same Out position", async () => {
    const { app, anna, groupId, players } = await table()
    const { id: gameId } = await startGame(app, anna.headers, {
      groupId,
      playerIds: [players.Anna, players.Ben, players.Carla, players.Dario],
    })
    const [annaP, benP, carlaP, darioP] = (
      await getGame(app, anna.headers, { gameId })
    ).participants
    const events = [
      // Ben swims; Carla and Dario are down to their last Life.
      { type: "lost", loser: benP.id },
      { type: "lost", loser: benP.id },
      { type: "lost", loser: benP.id },
      { type: "lost", loser: carlaP.id },
      { type: "lost", loser: carlaP.id },
      { type: "lost", loser: darioP.id },
      { type: "lost", loser: darioP.id },
      // Anna's Bomb puts all three Out at once.
      { type: "bomb", thrower: annaP.id },
    ] as const
    for (const [index, event] of events.entries()) {
      await recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: index,
        event,
      })
    }

    const game = await getGame(app, anna.headers, { gameId })
    expect(
      game.participants.map((p) => [p.name, p.summary?.outPosition])
    ).toEqual([
      ["Anna", null],
      ["Ben", 1],
      ["Carla", 1],
      ["Dario", 1],
    ])
  })

  it("takes no further Events", async () => {
    const { app, anna, gameId } = await playedToTheEnd()

    await expect(
      recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: 6,
        event: { type: "extraRound" },
      })
    ).rejects.toMatchObject({ code: "gameNotRunning" })
  })
})

describe("setting up a new Game", () => {
  it("offers all Players and preselects nobody in a Group without Games", async () => {
    const { app, anna, groupId } = await table()

    expect(await getNewGame(app, anna.headers, { groupId })).toEqual({
      groupName: "Donnerstagsrunde",
      players: [
        { id: expect.any(String), name: "Anna", guest: false },
        { id: expect.any(String), name: "Ben", guest: false },
        { id: expect.any(String), name: "Carla", guest: true },
        { id: expect.any(String), name: "Dario", guest: true },
      ],
      preselected: [],
    })
  })

  it("preselects the Participants of the Group's last Game in their Seating Order", async () => {
    const { app, anna, ben, groupId, players } = await table()
    await startGame(app, anna.headers, {
      groupId,
      playerIds: [players.Anna, players.Ben],
    })
    await startGame(app, ben.headers, {
      groupId,
      playerIds: [players.Dario, players.Anna, players.Ben],
    })

    const { preselected } = await getNewGame(app, anna.headers, { groupId })

    expect(preselected).toEqual([players.Dario, players.Anna, players.Ben])
  })

  it("is refused to an outsider", async () => {
    const { app, groupId } = await table()
    const mallory = await signUp(app.auth, { username: "mallory" })

    await expect(
      getNewGame(app, mallory.headers, { groupId })
    ).rejects.toMatchObject({ code: "groupNotFound" })
  })
})

describe("the Group's Games", () => {
  it("lists running and finished Games, newest first, with Participants, Winner and Swimmer", async () => {
    const {
      app,
      anna,
      ben,
      groupId,
      gameId: finished,
      players,
    } = await playedToTheEnd()
    const { id: running } = await startGame(app, ben.headers, {
      groupId,
      playerIds: [players.Ben, players.Dario],
    })
    const [, darioP] = (await getGame(app, ben.headers, { gameId: running }))
      .participants
    await recordEvent(app, ben.headers, {
      gameId: running,
      expectedVersion: 0,
      event: { type: "lost", loser: darioP.id },
    })

    expect(await listGames(app, anna.headers, { groupId })).toEqual([
      {
        id: running,
        status: "running",
        startedAt: expect.any(Date),
        participantCount: 2,
        round: 2,
        scorekeeper: "Ben",
        winner: null,
        swimmer: null,
      },
      {
        id: finished,
        status: "finished",
        startedAt: expect.any(Date),
        participantCount: 3,
        round: 6,
        scorekeeper: "Anna",
        winner: "Anna",
        swimmer: "Ben",
      },
    ])
  })

  it("are refused to an outsider", async () => {
    const { app, groupId } = await table()
    const mallory = await signUp(app.auth, { username: "mallory" })

    await expect(
      listGames(app, mallory.headers, { groupId })
    ).rejects.toMatchObject({ code: "groupNotFound" })
  })
})

/** A running Game of Anna, Ben and Carla, kept by Anna, with `losses` Rounds Ben lost. */
async function runningGame(losses: number) {
  const setup = await table()
  const { app, anna, groupId, players } = setup
  const { id: gameId } = await startGame(app, anna.headers, {
    groupId,
    playerIds: [players.Anna, players.Ben, players.Carla],
  })
  const ids = (await getGame(app, anna.headers, { gameId })).participants.map(
    (p) => p.id
  )
  for (let version = 0; version < losses; version++) {
    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: version,
      event: { type: "lost", loser: ids[1] },
    })
  }
  return { ...setup, gameId, ids }
}

describe("undoing an Event", () => {
  it("deletes the last Event, so the Game is as if it never happened", async () => {
    const { app, anna, gameId } = await runningGame(2)
    const before = await getGame(app, anna.headers, { gameId })

    expect(
      await undoEvent(app, anna.headers, { gameId, expectedVersion: 2 })
    ).toEqual({ version: 3 })

    const after = await getGame(app, anna.headers, { gameId })
    expect(after.version).toBe(3)
    expect(after.events).toEqual(before.events.slice(0, 1))
    expect(after.state.round).toBe(2)
    expect(after.state.participants[1].lives).toBe(2)
  })

  it("goes back step by step as far as wanted, then there is nothing left", async () => {
    const { app, anna, gameId } = await runningGame(3)

    for (const expectedVersion of [3, 4, 5]) {
      await undoEvent(app, anna.headers, { gameId, expectedVersion })
    }

    const game = await getGame(app, anna.headers, { gameId })
    expect(game.events).toEqual([])
    expect(game.state.round).toBe(1)
    await expect(
      undoEvent(app, anna.headers, { gameId, expectedVersion: 6 })
    ).rejects.toMatchObject({ code: "nothingToUndo" })
  })

  it("leaves no trace: the next Event takes the undone one's place", async () => {
    const { app, anna, gameId, ids, groupId } = await runningGame(1)
    await undoEvent(app, anna.headers, { gameId, expectedVersion: 1 })

    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: 2,
      event: { type: "lost", loser: ids[2] },
    })

    const game = await getGame(app, anna.headers, { gameId })
    expect(game.events).toEqual([{ type: "lost", loser: ids[2] }])
    expect(game.state.participants.map((p) => p.lives)).toEqual([3, 3, 2])
    const [listed] = await listGames(app, anna.headers, { groupId })
    expect(listed.round).toBe(2)
  })

  it("counts the version on, so a device that saw the undone Event cannot act on it", async () => {
    const { app, anna, gameId, ids } = await runningGame(2)
    // Undo Ben's second loss and record Carla's instead: two Events again.
    await undoEvent(app, anna.headers, { gameId, expectedVersion: 2 })
    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: 3,
      event: { type: "lost", loser: ids[2] },
    })

    // A device that last saw Ben's second loss (version 2) must not undo
    // Carla's in its place.
    await expect(
      undoEvent(app, anna.headers, { gameId, expectedVersion: 2 })
    ).rejects.toMatchObject({ code: "versionConflict" })
    expect((await getGame(app, anna.headers, { gameId })).version).toBe(4)
  })

  it("must be on top of the version the device has seen", async () => {
    const { app, anna, gameId } = await runningGame(2)

    await expect(
      undoEvent(app, anna.headers, { gameId, expectedVersion: 1 })
    ).rejects.toMatchObject({ code: "versionConflict" })
    expect((await getGame(app, anna.headers, { gameId })).version).toBe(2)
  })

  it("is only for the Scorekeeper", async () => {
    const { app, ben, gameId } = await runningGame(1)
    const mallory = await signUp(app.auth, { username: "Mallory" })

    await expect(
      undoEvent(app, ben.headers, { gameId, expectedVersion: 1 })
    ).rejects.toMatchObject({ code: "notScorekeeper" })
    await expect(
      undoEvent(app, mallory.headers, { gameId, expectedVersion: 1 })
    ).rejects.toMatchObject({ code: "gameNotFound" })
  })
})

describe("undoing after the end of a Game", () => {
  it("is possible for 10 minutes and runs the Game again without its summary", async () => {
    const { app, anna, gameId, groupId } = await playedToTheEnd()
    const finished = await getGame(app, anna.headers, { gameId })
    const finishedAt = finished.finishedAt ?? new Date(0)
    expect(finished.undoableUntil).toEqual(
      new Date(finishedAt.getTime() + 10 * 60_000)
    )
    app.now = () => new Date(finishedAt.getTime() + 9 * 60_000)

    await undoEvent(app, anna.headers, { gameId, expectedVersion: 6 })

    const game = await getGame(app, anna.headers, { gameId })
    expect(game.status).toBe("running")
    expect(game.events).toHaveLength(5)
    expect(game.finishedAt).toBeNull()
    expect(game.undoableUntil).toBeNull()
    expect(game.state.winner).toBeNull()
    expect(game.participants.map((p) => p.summary)).toEqual([null, null, null])
    const [listed] = await listGames(app, anna.headers, { groupId })
    expect(listed).toMatchObject({ status: "running", winner: null })
  })

  it("lets the Game end again, with a new summary", async () => {
    const { app, anna, gameId } = await playedToTheEnd()
    const [annaP, benP] = (await getGame(app, anna.headers, { gameId }))
      .participants
    await undoEvent(app, anna.headers, { gameId, expectedVersion: 6 })

    // This time Anna loses a Life before Ben, the Swimmer, is Out.
    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: 7,
      event: { type: "lost", loser: annaP.id },
    })
    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: 8,
      event: { type: "lost", loser: benP.id },
    })

    const game = await getGame(app, anna.headers, { gameId })
    expect(game.status).toBe("finished")
    expect(game.participants.map((p) => p.summary?.livesLost)).toEqual([
      1, 4, 3,
    ])
  })

  it("is refused after 10 minutes, and the Game stays finished", async () => {
    const { app, anna, gameId } = await playedToTheEnd()
    const before = await getGame(app, anna.headers, { gameId })
    const finishedAt = before.finishedAt ?? new Date(0)
    app.now = () => new Date(finishedAt.getTime() + 10 * 60_000 + 1)

    await expect(
      undoEvent(app, anna.headers, { gameId, expectedVersion: 6 })
    ).rejects.toMatchObject({ code: "undoExpired" })
    expect(await getGame(app, anna.headers, { gameId })).toEqual({
      ...before,
      serverTime: expect.any(Date),
    })
  })

  it("is only for the Scorekeeper", async () => {
    const { app, ben, gameId } = await playedToTheEnd()

    await expect(
      undoEvent(app, ben.headers, { gameId, expectedVersion: 6 })
    ).rejects.toMatchObject({ code: "notScorekeeper" })
  })
})

describe("cancelling a Game", () => {
  it("stops it for good; it stays in the Group's list, without a Winner", async () => {
    const { app, anna, gameId, groupId } = await runningGame(2)

    await cancelGame(app, anna.headers, { gameId })

    const game = await getGame(app, anna.headers, { gameId })
    expect(game.status).toBe("cancelled")
    // A change like any other: a device on the old version cannot act on it.
    expect(game.version).toBe(3)
    expect(game.finishedAt).toBeInstanceOf(Date)
    expect(game.undoableUntil).toBeNull()
    expect(game.participants.map((p) => p.summary)).toEqual([null, null, null])
    expect(await listGames(app, anna.headers, { groupId })).toMatchObject([
      { id: gameId, status: "cancelled", round: 3, winner: null },
    ])
  })

  it("leaves nothing to record, undo or cancel again", async () => {
    const { app, anna, gameId, ids } = await runningGame(1)
    await cancelGame(app, anna.headers, { gameId })

    await expect(
      recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: 1,
        event: { type: "lost", loser: ids[0] },
      })
    ).rejects.toMatchObject({ code: "gameNotRunning" })
    await expect(
      undoEvent(app, anna.headers, { gameId, expectedVersion: 1 })
    ).rejects.toMatchObject({ code: "gameNotRunning" })
    await expect(
      cancelGame(app, anna.headers, { gameId })
    ).rejects.toMatchObject({ code: "gameNotRunning" })
  })

  it("is not possible for a finished Game", async () => {
    const { app, anna, gameId } = await playedToTheEnd()

    await expect(
      cancelGame(app, anna.headers, { gameId })
    ).rejects.toMatchObject({ code: "gameNotRunning" })
  })

  it("is only for the Scorekeeper", async () => {
    const { app, ben, gameId } = await runningGame(1)
    const mallory = await signUp(app.auth, { username: "Mallory" })

    await expect(
      cancelGame(app, ben.headers, { gameId })
    ).rejects.toMatchObject({ code: "notScorekeeper" })
    await expect(
      cancelGame(app, mallory.headers, { gameId })
    ).rejects.toMatchObject({ code: "gameNotFound" })
    expect((await getGame(app, ben.headers, { gameId })).status).toBe("running")
  })
})

/**
 * A running Game of Anna, Ben, Carla and Dario, kept by Anna, after `events`;
 * `ids` in Seating Order.
 */
async function fourAtTheTable(
  events: (ids: Array<string>) => Array<GameEvent> = () => []
) {
  const setup = await table()
  const { app, anna, groupId, players } = setup
  const { id: gameId } = await startGame(app, anna.headers, {
    groupId,
    playerIds: [players.Anna, players.Ben, players.Carla, players.Dario],
  })
  const ids = (await getGame(app, anna.headers, { gameId })).participants.map(
    (p) => p.id
  )
  for (const [version, event] of events(ids).entries()) {
    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: version,
      event,
    })
  }
  return { ...setup, gameId, ids }
}

describe("adding a Tiebreak to a loss", () => {
  it("records who was in the Tiebreak with the last loss, without changing the state", async () => {
    const { app, anna, gameId, ids } = await fourAtTheTable((seat) => [
      { type: "lost", loser: seat[1] },
    ])
    const before = await getGame(app, anna.headers, { gameId })

    expect(
      await addTiebreak(app, anna.headers, {
        gameId,
        expectedVersion: 1,
        tiebreak: [ids[1], ids[3]],
      })
    ).toEqual({ version: 2 })

    const game = await getGame(app, anna.headers, { gameId })
    expect(game.version).toBe(2)
    expect(game.events).toEqual([
      { type: "lost", loser: ids[1], tiebreak: [ids[1], ids[3]] },
    ])
    expect(game.state).toEqual(before.state)
  })

  it("can be corrected: a new Tiebreak replaces the one recorded", async () => {
    const { app, anna, gameId, ids } = await fourAtTheTable((seat) => [
      { type: "lost", loser: seat[1], tiebreak: [seat[1], seat[3]] },
    ])

    await addTiebreak(app, anna.headers, {
      gameId,
      expectedVersion: 1,
      tiebreak: [ids[2], ids[1], ids[0]],
    })

    const game = await getGame(app, anna.headers, { gameId })
    expect(game.events).toEqual([
      { type: "lost", loser: ids[1], tiebreak: [ids[2], ids[1], ids[0]] },
    ])
  })

  it("may include the loser who went Out by that loss", async () => {
    // Carla loses three times and swims; her fourth loss puts her Out.
    const { app, anna, gameId, ids } = await fourAtTheTable((seat) => [
      { type: "lost", loser: seat[2] },
      { type: "lost", loser: seat[2] },
      { type: "lost", loser: seat[2] },
      { type: "lost", loser: seat[2] },
    ])
    const { state } = await getGame(app, anna.headers, { gameId })
    expect(state.participants[2].status).toBe("out")

    await addTiebreak(app, anna.headers, {
      gameId,
      expectedVersion: 4,
      tiebreak: [ids[2], ids[0]],
    })

    const game = await getGame(app, anna.headers, { gameId })
    expect(game.events.at(-1)).toEqual({
      type: "lost",
      loser: ids[2],
      tiebreak: [ids[2], ids[0]],
    })
  })

  it("is undone together with the loss it belongs to", async () => {
    const { app, anna, gameId, ids } = await fourAtTheTable((seat) => [
      { type: "lost", loser: seat[0] },
      { type: "lost", loser: seat[1] },
    ])
    await addTiebreak(app, anna.headers, {
      gameId,
      expectedVersion: 2,
      tiebreak: [ids[1], ids[2]],
    })

    await undoEvent(app, anna.headers, { gameId, expectedVersion: 3 })

    const game = await getGame(app, anna.headers, { gameId })
    expect(game.events).toEqual([{ type: "lost", loser: ids[0] }])
  })

  it.each([
    {
      case: "nothing was recorded yet",
      events: () => [],
    },
    {
      case: "the last Event is a Bomb",
      events: (ids: Array<string>) => [{ type: "bomb", thrower: ids[0] }],
    },
  ] satisfies Array<{
    case: string
    events: (ids: Array<string>) => Array<GameEvent>
  }>)("is refused when $case", async ({ events }) => {
    const { app, anna, gameId, ids } = await fourAtTheTable(events)
    const version = events(ids).length

    await expect(
      addTiebreak(app, anna.headers, {
        gameId,
        expectedVersion: version,
        tiebreak: [ids[0], ids[1]],
      })
    ).rejects.toMatchObject({ code: "noLossForTiebreak" })
  })

  it.each([
    {
      case: "only the loser is in it",
      tiebreak: (ids: Array<string>) => [ids[1]],
      code: "tiebreakNeedsTwoParticipants",
    },
    {
      case: "the loser is not in it",
      tiebreak: (ids: Array<string>) => [ids[2], ids[3]],
      code: "tiebreakWithoutLoser",
    },
    {
      case: "someone is in it twice",
      tiebreak: (ids: Array<string>) => [ids[1], ids[2], ids[2]],
      code: "tiebreakDuplicateParticipant",
    },
    {
      case: "someone is not in the Game",
      tiebreak: (ids: Array<string>) => [ids[1], "stranger"],
      code: "unknownParticipant",
    },
  ])(
    "follows the rules: refused when $case, and nothing changes",
    async ({ tiebreak, code }) => {
      const { app, anna, gameId, ids } = await fourAtTheTable((seat) => [
        { type: "lost", loser: seat[1] },
      ])

      await expect(
        addTiebreak(app, anna.headers, {
          gameId,
          expectedVersion: 1,
          tiebreak: tiebreak(ids),
        })
      ).rejects.toMatchObject({ code })

      const game = await getGame(app, anna.headers, { gameId })
      expect(game.version).toBe(1)
      expect(game.events).toEqual([{ type: "lost", loser: ids[1] }])
    }
  )

  it("is refused for someone already Out before the loss", async () => {
    // Dario is Out after swimming and losing again; Anna loses next.
    const { app, anna, gameId, ids } = await fourAtTheTable((seat) => [
      ...Array.from({ length: 4 }, () => ({
        type: "lost" as const,
        loser: seat[3],
      })),
      { type: "lost", loser: seat[0] },
    ])

    await expect(
      addTiebreak(app, anna.headers, {
        gameId,
        expectedVersion: 5,
        tiebreak: [ids[0], ids[3]],
      })
    ).rejects.toMatchObject({ code: "participantOut" })
  })

  it("is refused when only two were left, since they play an Extra Round instead", async () => {
    // Carla and Dario go Out; Anna loses with only Anna and Ben left.
    const { app, anna, gameId, ids } = await fourAtTheTable((seat) => [
      ...Array.from({ length: 4 }, () => ({
        type: "lost" as const,
        loser: seat[2],
      })),
      ...Array.from({ length: 3 }, () => ({
        type: "lost" as const,
        loser: seat[3],
      })),
      { type: "lost", loser: seat[0] },
    ])

    await expect(
      addTiebreak(app, anna.headers, {
        gameId,
        expectedVersion: 8,
        tiebreak: [ids[0], ids[1]],
      })
    ).rejects.toMatchObject({ code: "tiebreakNeedsMoreThanTwoRemaining" })
  })

  it("refuses a Tiebreak that is not a list of Participants", async () => {
    const { app, anna, gameId, ids } = await fourAtTheTable((seat) => [
      { type: "lost", loser: seat[1] },
    ])

    await expect(
      addTiebreak(app, anna.headers, {
        gameId,
        expectedVersion: 1,
        tiebreak: [ids[1], 7] as unknown as Array<string>,
      })
    ).rejects.toMatchObject({ code: "invalidEvent" })
  })

  it("must be on top of the version the device has seen", async () => {
    const { app, anna, gameId, ids } = await fourAtTheTable((seat) => [
      { type: "lost", loser: seat[0] },
      { type: "lost", loser: seat[1] },
    ])

    // A device that only saw Anna's loss must not put the Tiebreak on Ben's.
    await expect(
      addTiebreak(app, anna.headers, {
        gameId,
        expectedVersion: 1,
        tiebreak: [ids[0], ids[2]],
      })
    ).rejects.toMatchObject({ code: "versionConflict" })
    expect((await getGame(app, anna.headers, { gameId })).version).toBe(2)
  })

  it("is only for the Scorekeeper", async () => {
    const { app, ben, gameId, ids } = await fourAtTheTable((seat) => [
      { type: "lost", loser: seat[1] },
    ])
    const mallory = await signUp(app.auth, { username: "Mallory" })
    const input = { gameId, expectedVersion: 1, tiebreak: [ids[1], ids[2]] }

    await expect(addTiebreak(app, ben.headers, input)).rejects.toMatchObject({
      code: "notScorekeeper",
    })
    await expect(
      addTiebreak(app, mallory.headers, input)
    ).rejects.toMatchObject({ code: "gameNotFound" })
  })

  it("is not possible once the Game is cancelled", async () => {
    const { app, anna, gameId, ids } = await fourAtTheTable((seat) => [
      { type: "lost", loser: seat[1] },
    ])
    await cancelGame(app, anna.headers, { gameId })

    await expect(
      addTiebreak(app, anna.headers, {
        gameId,
        expectedVersion: 2,
        tiebreak: [ids[1], ids[2]],
      })
    ).rejects.toMatchObject({ code: "gameNotRunning" })
  })
})

describe("an Extra Round", () => {
  /** Anna and Ben left, Ben dealing Round 8 (Carla and Dario are Out). */
  const twoLeft = (ids: Array<string>): Array<GameEvent> => [
    ...Array.from({ length: 4 }, () => ({
      type: "lost" as const,
      loser: ids[2],
    })),
    ...Array.from({ length: 3 }, () => ({
      type: "lost" as const,
      loser: ids[3],
    })),
  ]

  it("is recorded when exactly two are left; the Round and its Dealer stay", async () => {
    const { app, anna, gameId } = await fourAtTheTable(twoLeft)
    const before = await getGame(app, anna.headers, { gameId })

    for (const expectedVersion of [7, 8]) {
      await recordEvent(app, anna.headers, {
        gameId,
        expectedVersion,
        event: { type: "extraRound" },
      })
    }

    const game = await getGame(app, anna.headers, { gameId })
    expect(game.version).toBe(9)
    expect(game.events.slice(-2)).toEqual([
      { type: "extraRound" },
      { type: "extraRound" },
    ])
    expect(game.state.round).toBe(before.state.round)
    expect(game.state.dealer).toBe(before.state.dealer)
  })

  it("is refused while more than two are left", async () => {
    const { app, anna, gameId } = await fourAtTheTable((seat) => [
      { type: "lost", loser: seat[1] },
    ])

    await expect(
      recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: 1,
        event: { type: "extraRound" },
      })
    ).rejects.toMatchObject({ code: "extraRoundNeedsTwoRemaining" })
  })

  it("can be undone", async () => {
    const { app, anna, gameId } = await fourAtTheTable((seat) => [
      ...twoLeft(seat),
      { type: "extraRound" },
    ])

    await undoEvent(app, anna.headers, { gameId, expectedVersion: 8 })

    const game = await getGame(app, anna.headers, { gameId })
    expect(game.events).toHaveLength(7)
    expect(game.events.at(-1)?.type).toBe("lost")
  })
})

describe("every game command", () => {
  it.each([
    {
      command: "getNewGame",
      run: (app, headers) => getNewGame(app, headers, { groupId: "g" }),
    },
    {
      command: "startGame",
      run: (app, headers) =>
        startGame(app, headers, { groupId: "g", playerIds: ["a", "b"] }),
    },
    {
      command: "getGame",
      run: (app, headers) => getGame(app, headers, { gameId: "x" }),
    },
    {
      command: "recordEvent",
      run: (app, headers) =>
        recordEvent(app, headers, {
          gameId: "x",
          expectedVersion: 0,
          event: { type: "extraRound" },
        }),
    },
    {
      command: "listGames",
      run: (app, headers) => listGames(app, headers, { groupId: "g" }),
    },
    {
      command: "undoEvent",
      run: (app, headers) =>
        undoEvent(app, headers, { gameId: "x", expectedVersion: 1 }),
    },
    {
      command: "addTiebreak",
      run: (app, headers) =>
        addTiebreak(app, headers, {
          gameId: "x",
          expectedVersion: 1,
          tiebreak: ["a", "b"],
        }),
    },
    {
      command: "cancelGame",
      run: (app, headers) => cancelGame(app, headers, { gameId: "x" }),
    },
  ] satisfies Array<{
    command: string
    run: (app: App, headers: Headers) => Promise<unknown>
  }>)("refuses $command without a session", async ({ run }) => {
    const app = await createTestApp()

    await expect(run(app, new Headers())).rejects.toMatchObject({
      code: "notSignedIn",
    })
  })
})
