import { describe, expect, it } from "vitest"
import {
  addTiebreak,
  cancelGame,
  getGame,
  getSpectatorGame,
  recordEvent,
  startGame,
  undoEvent,
} from "./games"
import { addGuest, createGroup, getGroup } from "./groups"
import { joinViaInvite } from "./testing/groups"
import { createTestApp, signUp } from "./testing/test-app"
import type { Notifier } from "./app"

/**
 * A running Game of Anna (Scorekeeper), Ben (account) and the Guests Carla
 * and Dario, in this Seating Order; `ids` are the Participants'.
 */
async function runningGame(options?: { notifier?: Notifier }) {
  const app = await createTestApp(options)
  const anna = await signUp(app.auth, { username: "Anna" })
  const ben = await signUp(app.auth, { username: "Ben" })
  const { id: groupId } = await createGroup(app, anna.headers, {
    name: "Donnerstagsrunde",
  })
  await joinViaInvite(app, groupId, ben.headers)
  await addGuest(app, anna.headers, { groupId, name: "Carla" })
  await addGuest(app, anna.headers, { groupId, name: "Dario" })
  const players = Object.fromEntries(
    (await getGroup(app, anna.headers, { groupId })).players.map((p) => [
      p.name,
      p.id,
    ])
  )
  const { id: gameId } = await startGame(app, anna.headers, {
    groupId,
    playerIds: [players.Anna, players.Ben, players.Carla, players.Dario],
  })
  const ids = (await getGame(app, anna.headers, { gameId })).participants.map(
    (p) => p.id
  )
  return { app, anna, ben, groupId, gameId, ids }
}

/** Plays the running Game to its end: Ben, Carla and Dario go Out. */
async function playToTheEnd(
  { app, anna, gameId, ids }: Awaited<ReturnType<typeof runningGame>>,
  fromVersion: number
) {
  let version = fromVersion
  // Three Lives and once more as the Swimmer, then three Lives each.
  const losers = [
    ...Array<string>(4).fill(ids[1]),
    ...Array<string>(3).fill(ids[2]),
    ...Array<string>(3).fill(ids[3]),
  ]
  for (const loser of losers) {
    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: version++,
      event: { type: "lost", loser },
    })
  }
  return version
}

describe("Game changed notifications", () => {
  it("go out after an Event is recorded, with the Game's new version", async () => {
    const { app, anna, gameId, ids } = await runningGame()

    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: 0,
      event: { type: "lost", loser: ids[1] },
    })

    expect(app.notifications).toEqual([{ gameId, version: 1 }])
  })

  it("go out after every other change of a Game: Tiebreak, Undo, cancelling", async () => {
    const { app, anna, gameId, ids } = await runningGame()
    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: 0,
      event: { type: "lost", loser: ids[1] },
    })

    await addTiebreak(app, anna.headers, {
      gameId,
      expectedVersion: 1,
      tiebreak: [ids[1], ids[2]],
    })
    await undoEvent(app, anna.headers, { gameId, expectedVersion: 2 })
    await cancelGame(app, anna.headers, { gameId })

    expect(app.notifications).toEqual([
      { gameId, version: 1 },
      { gameId, version: 2 },
      { gameId, version: 3 },
      { gameId, version: 4 },
    ])
  })

  it("go out when the Event ends the Game", async () => {
    const setup = await runningGame()
    const version = await playToTheEnd(setup, 0)

    expect(setup.app.notifications.at(-1)).toEqual({
      gameId: setup.gameId,
      version,
    })
    const game = await getGame(setup.app, setup.anna.headers, {
      gameId: setup.gameId,
    })
    expect(game.status).toBe("finished")
  })

  it("do not go out for refused commands", async () => {
    const { app, anna, ben, gameId, ids } = await runningGame()

    const refused = [
      // Not the Scorekeeper.
      recordEvent(app, ben.headers, {
        gameId,
        expectedVersion: 0,
        event: { type: "lost", loser: ids[1] },
      }),
      // A version the Game is not at.
      recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: 5,
        event: { type: "lost", loser: ids[1] },
      }),
      // Against the rules: four are left.
      recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: 0,
        event: { type: "extraRound" },
      }),
      undoEvent(app, anna.headers, { gameId, expectedVersion: 0 }),
      addTiebreak(app, anna.headers, {
        gameId,
        expectedVersion: 0,
        tiebreak: [ids[1], ids[2]],
      }),
      cancelGame(app, ben.headers, { gameId }),
    ]
    for (const command of refused) {
      await expect(command).rejects.toHaveProperty("code")
    }

    expect(app.notifications).toEqual([])
  })

  it("do not go out for starting or reading a Game", async () => {
    const { app, anna, gameId } = await runningGame()

    await getGame(app, anna.headers, { gameId })

    expect(app.notifications).toEqual([])
  })

  it("never make a command fail: what was recorded stays", async () => {
    const { app, anna, gameId, ids } = await runningGame({
      notifier: {
        gameChanged: () => Promise.reject(new Error("Pusher is down")),
        scorekeeperPresenceChanged: () => Promise.resolve(),
      },
    })

    await expect(
      recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: 0,
        event: { type: "lost", loser: ids[1] },
      })
    ).resolves.toEqual({ version: 1 })

    expect((await getGame(app, anna.headers, { gameId })).version).toBe(1)
  })
})

describe("the Spectator link", () => {
  it("is offered to every Player of the Group while the Game runs, one per Game", async () => {
    const setup = await runningGame()
    const { app, anna, ben, groupId, gameId } = setup

    const forAnna = (await getGame(app, anna.headers, { gameId }))
      .spectatorToken
    const forBen = (await getGame(app, ben.headers, { gameId })).spectatorToken

    expect(forAnna).toEqual(expect.any(String))
    // At least 128 random bits, URL-safe.
    expect(forAnna).toMatch(/^[\w-]{22,}$/)
    expect(forBen).toBe(forAnna)
    const players = (await getGroup(app, anna.headers, { groupId })).players
    const { id: other } = await startGame(app, anna.headers, {
      groupId,
      playerIds: players.slice(0, 2).map((p) => p.id),
    })
    expect(
      (await getGame(app, anna.headers, { gameId: other })).spectatorToken
    ).not.toBe(forAnna)
  })

  it("shows the running Game without an account, read-only and without anyone's account details", async () => {
    const { app, anna, gameId, ids } = await runningGame()
    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: 0,
      event: { type: "lost", loser: ids[1] },
    })
    const game = await getGame(app, anna.headers, { gameId })

    const view = await getSpectatorGame(app, { token: game.spectatorToken! })

    expect(view).toEqual({
      id: gameId,
      groupName: "Donnerstagsrunde",
      ruleSet: game.ruleSet,
      version: 1,
      scorekeeper: "Anna",
      scorekeeperParticipantId: ids[0],
      scorekeeperOfflineSince: null,
      serverTime: expect.any(Date),
      participants: [
        { id: ids[0], name: "Anna" },
        { id: ids[1], name: "Ben" },
        { id: ids[2], name: "Carla" },
        { id: ids[3], name: "Dario" },
      ],
      events: game.events,
      state: game.state,
    })
  })

  it("shows nothing once the Game is over, and is no longer offered", async () => {
    const setup = await runningGame()
    const { app, anna, gameId } = setup
    const { spectatorToken } = await getGame(app, anna.headers, { gameId })
    await playToTheEnd(setup, 0)

    await expect(
      getSpectatorGame(app, { token: spectatorToken! })
    ).rejects.toMatchObject({ code: "spectatorLinkExpired" })
    expect(
      (await getGame(app, anna.headers, { gameId })).spectatorToken
    ).toBeNull()
  })

  it("shows nothing once the Game is cancelled", async () => {
    const { app, anna, gameId } = await runningGame()
    const { spectatorToken } = await getGame(app, anna.headers, { gameId })
    await cancelGame(app, anna.headers, { gameId })

    await expect(
      getSpectatorGame(app, { token: spectatorToken! })
    ).rejects.toMatchObject({ code: "spectatorLinkExpired" })
    expect(
      (await getGame(app, anna.headers, { gameId })).spectatorToken
    ).toBeNull()
  })

  it("works again when the end of the Game is undone, since it runs again", async () => {
    const setup = await runningGame()
    const { app, anna, gameId } = setup
    const { spectatorToken } = await getGame(app, anna.headers, { gameId })
    const version = await playToTheEnd(setup, 0)

    await undoEvent(app, anna.headers, { gameId, expectedVersion: version })

    await expect(
      getSpectatorGame(app, { token: spectatorToken! })
    ).resolves.toMatchObject({ id: gameId })
  })

  it("is refused for a token no Game has", async () => {
    const { app } = await runningGame()

    await expect(
      getSpectatorGame(app, { token: "nicht-geraten-aber-falsch" })
    ).rejects.toMatchObject({ code: "spectatorLinkNotFound" })
  })
})

describe("the Scorekeeper's row", () => {
  it("is known to every Player, so the Game can mark who keeps score", async () => {
    const { app, ben, gameId, ids } = await runningGame()

    const game = await getGame(app, ben.headers, { gameId })

    expect(game.scorekeeperParticipantId).toBe(ids[0])
  })
})
