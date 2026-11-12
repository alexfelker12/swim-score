import { describe, expect, it } from "vitest"
import {
  authorizePresence,
  cancelGame,
  getGame,
  getSpectatorGame,
  recordEvent,
  recordPresence,
  startGame,
  takeOver,
  undoEvent,
} from "./games"
import { addGuest, createGroup, getGroup, handOverAdmin } from "./groups"
import { deleteAccount } from "./profile"
import { joinViaInvite } from "./testing/groups"
import { createTestApp, signUp } from "./testing/test-app"

const MINUTE = 60_000

/**
 * A running Game kept by Anna, with Ben (account) and the Guest Carla in
 * this Seating Order; Dora is in the Group but not in the Game. The clock
 * stands still at `start` until a test moves it with `at`.
 */
async function runningGame() {
  const app = await createTestApp()
  const start = new Date("2026-11-12T20:00:00Z")
  let now = start
  app.now = () => now
  const at = (ms: number) => {
    now = new Date(start.getTime() + ms)
    return now
  }
  const anna = await signUp(app.auth, { username: "Anna" })
  const ben = await signUp(app.auth, { username: "Ben" })
  const dora = await signUp(app.auth, { username: "Dora" })
  const { id: groupId } = await createGroup(app, anna.headers, {
    name: "Donnerstagsrunde",
  })
  await joinViaInvite(app, groupId, ben.headers)
  await joinViaInvite(app, groupId, dora.headers)
  await addGuest(app, anna.headers, { groupId, name: "Carla" })
  const players = Object.fromEntries(
    (await getGroup(app, anna.headers, { groupId })).players.map((p) => [
      p.name,
      p,
    ])
  )
  const { id: gameId } = await startGame(app, anna.headers, {
    groupId,
    playerIds: [players.Anna.id, players.Ben.id, players.Carla.id],
  })
  const ids = (await getGame(app, anna.headers, { gameId })).participants.map(
    (p) => p.id
  )
  const userId = { anna: anna.user.id, ben: ben.user.id }
  /** What Pusher reports about Anna's device. */
  const annaIs = (connected: boolean, ms: number) =>
    recordPresence(app, {
      gameId,
      userId: userId.anna,
      connected,
      at: at(ms),
    })
  /** Anna deletes her account (handing the Group to Ben first). */
  const annaLeaves = async () => {
    await handOverAdmin(app, anna.headers, {
      groupId,
      playerId: players.Ben.id,
    })
    await deleteAccount(app, anna.headers)
  }
  return {
    app,
    at,
    anna,
    ben,
    dora,
    groupId,
    gameId,
    ids,
    userId,
    annaIs,
    annaLeaves,
  }
}

describe("taking over as Scorekeeper", () => {
  it("is possible at once while the Scorekeeper's device is connected", async () => {
    const { app, anna, ben, gameId, ids, annaIs } = await runningGame()
    await annaIs(true, 0)

    expect(await takeOver(app, ben.headers, { gameId })).toEqual({
      version: 1,
    })

    const game = await getGame(app, ben.headers, { gameId })
    expect(game.isScorekeeper).toBe(true)
    expect(game.scorekeeper).toBe("Ben")
    expect(game.scorekeeperParticipantId).toBe(ids[1])
    expect((await getGame(app, anna.headers, { gameId })).isScorekeeper).toBe(
      false
    )
  })

  it("is possible at once while nothing is known about the Scorekeeper's device", async () => {
    const { app, ben, gameId } = await runningGame()

    await takeOver(app, ben.headers, { gameId })

    expect((await getGame(app, ben.headers, { gameId })).isScorekeeper).toBe(
      true
    )
  })

  it("is blocked for about 2 minutes after the Scorekeeper went offline", async () => {
    const { app, at, ben, gameId, annaIs } = await runningGame()
    await annaIs(false, 0)
    at(2 * MINUTE - 1)

    await expect(takeOver(app, ben.headers, { gameId })).rejects.toMatchObject({
      code: "scorekeeperJustWentOffline",
    })
    await expect(
      takeOver(app, ben.headers, { gameId, confirmOffline: true })
    ).rejects.toMatchObject({ code: "scorekeeperJustWentOffline" })
    expect((await getGame(app, ben.headers, { gameId })).version).toBe(0)
  })

  it("then needs the warning confirmed that unsent Events are lost", async () => {
    const { app, at, ben, gameId, annaIs } = await runningGame()
    await annaIs(false, 0)
    at(2 * MINUTE)

    await expect(takeOver(app, ben.headers, { gameId })).rejects.toMatchObject({
      code: "takeoverNeedsConfirmation",
    })
    await takeOver(app, ben.headers, { gameId, confirmOffline: true })

    expect((await getGame(app, ben.headers, { gameId })).isScorekeeper).toBe(
      true
    )
  })

  it("is possible at once again when the Scorekeeper is back", async () => {
    const { app, ben, gameId, annaIs } = await runningGame()
    await annaIs(false, 0)
    await annaIs(true, 30_000)

    await takeOver(app, ben.headers, { gameId })

    expect((await getGame(app, ben.headers, { gameId })).isScorekeeper).toBe(
      true
    )
  })

  it("is possible at once when the Scorekeeper's account is deleted", async () => {
    const { app, ben, gameId, annaLeaves } = await runningGame()
    await annaLeaves()

    await takeOver(app, ben.headers, { gameId })

    expect((await getGame(app, ben.headers, { gameId })).scorekeeper).toBe(
      "Ben"
    )
  })

  it("moves the Game on, so the former Scorekeeper's Events are refused", async () => {
    const { app, anna, ben, gameId, ids } = await runningGame()
    await takeOver(app, ben.headers, { gameId })

    // Anna's device still thinks it is at version 0 and keeps score.
    await expect(
      recordEvent(app, anna.headers, {
        gameId,
        expectedVersion: 0,
        event: { type: "lost", loser: ids[2] },
      })
    ).rejects.toMatchObject({ code: "notScorekeeper" })
    await recordEvent(app, ben.headers, {
      gameId,
      expectedVersion: 1,
      event: { type: "lost", loser: ids[2] },
    })
    expect((await getGame(app, ben.headers, { gameId })).version).toBe(2)
  })

  it("tells every device showing the Game", async () => {
    const { app, ben, gameId } = await runningGame()

    await takeOver(app, ben.headers, { gameId })

    expect(app.notifications).toEqual([{ gameId, version: 1 }])
  })

  it("can go back and forth", async () => {
    const { app, anna, ben, gameId } = await runningGame()

    await takeOver(app, ben.headers, { gameId })
    await takeOver(app, anna.headers, { gameId })

    expect((await getGame(app, anna.headers, { gameId })).isScorekeeper).toBe(
      true
    )
  })

  it.each([
    {
      case: "the Scorekeeper",
      who: "anna" as const,
      code: "alreadyScorekeeper",
    },
    {
      case: "a Player of the Group outside the Game",
      who: "dora" as const,
      code: "notParticipant",
    },
  ])("is refused for $case", async ({ who, code }) => {
    const setup = await runningGame()

    await expect(
      takeOver(setup.app, setup[who].headers, { gameId: setup.gameId })
    ).rejects.toMatchObject({ code })
  })

  it("is refused for someone outside the Group", async () => {
    const { app, gameId } = await runningGame()
    const mallory = await signUp(app.auth, { username: "Mallory" })

    await expect(
      takeOver(app, mallory.headers, { gameId })
    ).rejects.toMatchObject({ code: "gameNotFound" })
  })

  it("is refused once the Game is over", async () => {
    const { app, anna, ben, gameId } = await runningGame()
    await cancelGame(app, anna.headers, { gameId })

    await expect(takeOver(app, ben.headers, { gameId })).rejects.toMatchObject({
      code: "gameNotRunning",
    })
  })

  it("is refused without a session", async () => {
    const { app, gameId } = await runningGame()

    await expect(
      takeOver(app, new Headers(), { gameId })
    ).rejects.toMatchObject({ code: "notSignedIn" })
  })
})

describe("the Game history of takeovers", () => {
  it("places each takeover after the Events before it, with who was replaced and whether they were offline", async () => {
    const { app, at, anna, ben, gameId, ids, annaIs } = await runningGame()
    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: 0,
      event: { type: "lost", loser: ids[2] },
    })
    await annaIs(false, 0)
    at(3 * MINUTE)
    await takeOver(app, ben.headers, { gameId, confirmOffline: true })
    await recordEvent(app, ben.headers, {
      gameId,
      expectedVersion: 2,
      event: { type: "lost", loser: ids[2] },
    })
    await takeOver(app, anna.headers, { gameId })

    const game = await getGame(app, anna.headers, { gameId })
    expect(game.takeovers).toEqual([
      { afterEvents: 1, by: ids[1], from: ids[0], fromWasOffline: true },
      { afterEvents: 2, by: ids[0], from: ids[1], fromWasOffline: false },
    ])
  })

  it("keeps its place when the Game's version and the Events' count drift apart", async () => {
    const { app, anna, ben, gameId, ids } = await runningGame()
    const lose = (headers: Headers, expectedVersion: number) =>
      recordEvent(app, headers, {
        gameId,
        expectedVersion,
        event: { type: "lost", loser: ids[2] },
      })
    await lose(anna.headers, 0)
    await takeOver(app, ben.headers, { gameId })
    await lose(ben.headers, 2)
    await takeOver(app, anna.headers, { gameId })
    await lose(anna.headers, 4)

    expect(
      (await getGame(app, anna.headers, { gameId })).takeovers.map(
        (t) => t.afterEvents
      )
    ).toEqual([1, 2])
  })

  it("moves before Events recorded after it, when Events before it are undone", async () => {
    const { app, anna, ben, gameId, ids } = await runningGame()
    for (const expectedVersion of [0, 1]) {
      await recordEvent(app, anna.headers, {
        gameId,
        expectedVersion,
        event: { type: "lost", loser: ids[2] },
      })
    }
    await takeOver(app, ben.headers, { gameId })

    await undoEvent(app, ben.headers, { gameId, expectedVersion: 3 })
    await recordEvent(app, ben.headers, {
      gameId,
      expectedVersion: 4,
      event: { type: "lost", loser: ids[0] },
    })

    expect(
      (await getGame(app, ben.headers, { gameId })).takeovers.map(
        (t) => t.afterEvents
      )
    ).toEqual([1])
  })

  it("has no one replaced when the Scorekeeper's account was deleted", async () => {
    const { app, ben, gameId, ids, annaLeaves } = await runningGame()
    await annaLeaves()

    await takeOver(app, ben.headers, { gameId })

    expect((await getGame(app, ben.headers, { gameId })).takeovers).toEqual([
      { afterEvents: 0, by: ids[1], from: null, fromWasOffline: false },
    ])
  })
})

describe("the Scorekeeper's presence", () => {
  it("shows when the Scorekeeper went offline, to Players and Spectators", async () => {
    const { app, at, ben, gameId, annaIs } = await runningGame()
    const wentOffline = await annaIs(false, 0).then(() => at(0))
    at(40_000)

    const game = await getGame(app, ben.headers, { gameId })
    expect(game.scorekeeperOfflineSince).toEqual(wentOffline)
    expect(game.serverTime).toEqual(at(40_000))
    const spectators = await getSpectatorGame(app, {
      token: game.spectatorToken!,
    })
    expect(spectators.scorekeeperOfflineSince).toEqual(wentOffline)
    expect(spectators.serverTime).toEqual(at(40_000))
  })

  it("is not shown while connected or unknown", async () => {
    const { app, ben, gameId, annaIs } = await runningGame()
    expect(
      (await getGame(app, ben.headers, { gameId })).scorekeeperOfflineSince
    ).toBeNull()

    await annaIs(true, 0)

    expect(
      (await getGame(app, ben.headers, { gameId })).scorekeeperOfflineSince
    ).toBeNull()
  })

  it("ignores reports older than the one already known (webhooks can arrive out of order)", async () => {
    const { app, ben, gameId, annaIs } = await runningGame()
    await annaIs(true, 10_000)

    await annaIs(false, 5_000)

    expect(
      (await getGame(app, ben.headers, { gameId })).scorekeeperOfflineSince
    ).toBeNull()
  })

  it("is connected again as soon as the Scorekeeper records something", async () => {
    const { app, anna, ben, gameId, ids, annaIs } = await runningGame()
    await annaIs(false, 0)

    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: 0,
      event: { type: "lost", loser: ids[2] },
    })

    expect(
      (await getGame(app, ben.headers, { gameId })).scorekeeperOfflineSince
    ).toBeNull()
  })

  it("takes Pusher's later report of going offline even when recording set it connected by the server's clock", async () => {
    const { app, at, anna, ben, gameId, ids, annaIs } = await runningGame()
    await annaIs(false, 0)
    // The server's clock runs ahead of Pusher's.
    at(60_000)
    await recordEvent(app, anna.headers, {
      gameId,
      expectedVersion: 0,
      event: { type: "lost", loser: ids[2] },
    })

    await annaIs(false, 10_000)

    expect(
      (await getGame(app, ben.headers, { gameId })).scorekeeperOfflineSince
    ).toEqual(at(10_000))
  })

  it("counts whoever takes over as connected", async () => {
    const { app, at, ben, gameId, userId } = await runningGame()
    await recordPresence(app, {
      gameId,
      userId: userId.ben,
      connected: false,
      at: at(0),
    })

    await takeOver(app, ben.headers, { gameId })

    expect(
      (await getGame(app, ben.headers, { gameId })).scorekeeperOfflineSince
    ).toBeNull()
  })

  it("tells the devices when the Scorekeeper's presence changes, not for others", async () => {
    const { app, at, gameId, userId, annaIs } = await runningGame()

    await annaIs(false, 0)
    await annaIs(false, 1_000)
    await recordPresence(app, {
      gameId,
      userId: userId.ben,
      connected: false,
      at: at(2_000),
    })
    await annaIs(true, 3_000)

    expect(app.notifications).toEqual([
      { gameId, presence: true },
      { gameId, presence: true },
    ])
  })

  it("ignores reports for unknown Games or accounts", async () => {
    const { app, at, gameId, userId } = await runningGame()

    await recordPresence(app, {
      gameId: "unknown",
      userId: userId.anna,
      connected: false,
      at: at(0),
    })
    await recordPresence(app, {
      gameId,
      userId: "unknown",
      connected: false,
      at: at(0),
    })

    expect(app.notifications).toEqual([])
  })
})

describe("the presence channel", () => {
  it("lets in every Participant with an account, as themselves", async () => {
    const { app, ben, gameId, userId } = await runningGame()

    expect(await authorizePresence(app, ben.headers, { gameId })).toEqual({
      userId: userId.ben,
    })
  })

  it("is refused for those not in the Game, and without a session", async () => {
    const { app, dora, gameId } = await runningGame()
    const mallory = await signUp(app.auth, { username: "Mallory" })

    await expect(
      authorizePresence(app, dora.headers, { gameId })
    ).rejects.toMatchObject({ code: "notParticipant" })
    await expect(
      authorizePresence(app, mallory.headers, { gameId })
    ).rejects.toMatchObject({ code: "gameNotFound" })
    await expect(
      authorizePresence(app, new Headers(), { gameId })
    ).rejects.toMatchObject({ code: "notSignedIn" })
  })
})

describe("who can take over", () => {
  it("is told to Participants with an account who do not keep score, while the Game runs", async () => {
    const { app, anna, ben, dora, gameId } = await runningGame()

    expect((await getGame(app, ben.headers, { gameId })).canTakeOver).toBe(true)
    expect((await getGame(app, anna.headers, { gameId })).canTakeOver).toBe(
      false
    )
    expect((await getGame(app, dora.headers, { gameId })).canTakeOver).toBe(
      false
    )
    await cancelGame(app, anna.headers, { gameId })
    expect((await getGame(app, ben.headers, { gameId })).canTakeOver).toBe(
      false
    )
  })
})
