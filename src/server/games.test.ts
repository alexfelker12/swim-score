import { describe, expect, it } from "vitest"
import { getGame, getNewGame, listGames, recordEvent, startGame } from "./games"
import { addGuest, createGroup, getGroup } from "./groups"
import { joinGroup } from "./testing/groups"
import { createTestApp, signUp } from "./testing/test-app"
import type { App } from "./app"

/** Anna's Group "Donnerstagsrunde" with Ben (account) and the Guests Carla and Dario. */
async function table() {
  const app = await createTestApp()
  const anna = await signUp(app.auth, { username: "Anna" })
  const ben = await signUp(app.auth, { username: "Ben" })
  const { id: groupId } = await createGroup(app, anna.headers, {
    name: "Donnerstagsrunde",
  })
  await joinGroup(app, groupId, ben.user.id)
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
