import { describe, expect, it } from "vitest"
import {
  cancelGame,
  getGame,
  getNewGame,
  recordEvent,
  startGame,
} from "./games"
import { addGuest, createGroup, getGroup, leaveGroup } from "./groups"
import { getHome, listHomeGroups } from "./home"
import { joinViaInvite } from "./testing/groups"
import { createTestApp, signUp } from "./testing/test-app"
import type { TestApp } from "./testing/test-app"

/**
 * Anna created "Donnerstagsrunde" (with Ben and the Guest Dario), then
 * "Familie am See" (with Ben).
 */
async function setup() {
  const app = await createTestApp()
  const anna = await signUp(app.auth, { username: "Anna" })
  const ben = await signUp(app.auth, { username: "Ben" })
  app.now = () => new Date("2026-11-01T18:00:00Z")
  const { id: thursday } = await createGroup(app, anna.headers, {
    name: "Donnerstagsrunde",
  })
  await joinViaInvite(app, thursday, ben.headers)
  await addGuest(app, anna.headers, { groupId: thursday, name: "Dario" })
  app.now = () => new Date("2026-11-02T18:00:00Z")
  const { id: family } = await createGroup(app, anna.headers, {
    name: "Familie am See",
  })
  await joinViaInvite(app, family, ben.headers)
  const ids = async (groupId: string) =>
    Object.fromEntries(
      (await getGroup(app, anna.headers, { groupId })).players.map((p) => [
        p.name,
        p.id,
      ])
    )
  return {
    app,
    anna,
    ben,
    thursday,
    family,
    inThursday: await ids(thursday),
    inFamily: await ids(family),
  }
}

/** Records Losses in a running Game, by seat, as its Scorekeeper. */
async function lose(
  app: TestApp,
  headers: Headers,
  gameId: string,
  seats: Array<number>
) {
  const { participants, version } = await getGame(app, headers, { gameId })
  for (const [i, seat] of seats.entries()) {
    await recordEvent(app, headers, {
      gameId,
      expectedVersion: version + i,
      event: { type: "lost", loser: participants[seat].id },
    })
  }
}

describe("the Groups on the start page, page by page", () => {
  it("come played most recently first, newest joined first without a Game, as many as asked for", async () => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "Anna" })
    const ids: Array<string> = []
    for (let i = 0; i < 18; i++) {
      const { id } = await createGroup(app, anna.headers, {
        name: `Runde ${i}`,
      })
      ids.push(id)
    }
    const [annaIn5] = (await getGroup(app, anna.headers, { groupId: ids[5] }))
      .players
    await addGuest(app, anna.headers, { groupId: ids[5], name: "Ben" })
    const ben = (
      await getGroup(app, anna.headers, { groupId: ids[5] })
    ).players.find((p) => p.name === "Ben")!
    await startGame(app, anna.headers, {
      groupId: ids[5],
      playerIds: [annaIn5.id, ben.id],
    })

    const first = await listHomeGroups(app, anna.headers, {
      page: { size: 15 },
    })
    const second = await listHomeGroups(app, anna.headers, {
      page: { size: 15, after: first.next },
    })

    expect(first.items).toHaveLength(15)
    expect(second).toMatchObject({ next: null })
    expect([...first.items, ...second.items].map((g) => g.id)).toEqual([
      ids[5],
      ...ids.filter((id) => id !== ids[5]).reverse(),
    ])
  })

  it("are only for signed-in accounts", async () => {
    const app = await createTestApp()

    await expect(listHomeGroups(app, new Headers())).rejects.toMatchObject({
      code: "notSignedIn",
    })
  })
})

describe("the start page", () => {
  it("is empty without a Group", async () => {
    const app = await createTestApp()
    const erik = await signUp(app.auth, { username: "Erik" })

    expect(await getHome(app, erik.headers)).toEqual({
      runningGames: [],
      newGame: null,
    })
    expect(await listHomeGroups(app, erik.headers)).toEqual({
      items: [],
      next: null,
    })
  })

  it("starts the next Game in the newest Group before any Game was played", async () => {
    const { app, anna, thursday, family } = await setup()

    const home = await getHome(app, anna.headers)

    expect(home.runningGames).toEqual([])
    expect(home.newGame).toEqual({
      groupId: family,
      groupName: "Familie am See",
      lastPlayedAt: null,
    })
    expect((await listHomeGroups(app, anna.headers)).items).toEqual([
      {
        id: family,
        name: "Familie am See",
        playerCount: 2,
        running: false,
        lastPlayedAt: null,
      },
      {
        id: thursday,
        name: "Donnerstagsrunde",
        playerCount: 3,
        running: false,
        lastPlayedAt: null,
      },
    ])
  })

  it("shows a running Game I play in with its Round and short standings", async () => {
    const { app, anna, thursday, inThursday } = await setup()
    app.now = () => new Date("2026-11-05T19:00:00Z")
    const { id: gameId } = await startGame(app, anna.headers, {
      groupId: thursday,
      playerIds: [inThursday.Anna, inThursday.Ben, inThursday.Dario],
    })
    // Ben: 3 Losses make him the Swimmer; Dario loses once.
    await lose(app, anna.headers, gameId, [1, 1, 1, 2])

    const home = await getHome(app, anna.headers)

    expect(home.runningGames).toEqual([
      {
        id: gameId,
        groupId: thursday,
        groupName: "Donnerstagsrunde",
        startedAt: new Date("2026-11-05T19:00:00Z"),
        lastActivityAt: expect.any(Date),
        round: 5,
        participantCount: 3,
        scorekeeper: "Anna",
        isScorekeeper: true,
        standings: [
          { name: "Anna", lives: 3, swimming: false },
          // The Swimmer keeps the Life the rules no longer count.
          { name: "Ben", lives: 1, swimming: true },
          { name: "Dario", lives: 2, swimming: false },
        ],
      },
    ])
    expect(
      (await listHomeGroups(app, anna.headers)).items.find(
        (g) => g.id === thursday
      )
    ).toMatchObject({
      running: true,
      lastPlayedAt: new Date("2026-11-05T19:00:00Z"),
    })
  })

  it("leaves Players who are Out out of the standings", async () => {
    const { app, anna, thursday, inThursday } = await setup()
    const { id: gameId } = await startGame(app, anna.headers, {
      groupId: thursday,
      playerIds: [inThursday.Anna, inThursday.Ben, inThursday.Dario],
    })
    // Ben swims, then Dario loses all three Lives and is Out.
    await lose(app, anna.headers, gameId, [1, 1, 1, 2, 2, 2])

    const [running] = (await getHome(app, anna.headers)).runningGames

    expect(running.standings.map((s) => s.name)).toEqual(["Anna", "Ben"])
  })

  it("lists only running Games I take part in, most recently active first, and who keeps score", async () => {
    const { app, anna, ben, thursday, family, inThursday, inFamily } =
      await setup()
    app.now = () => new Date("2026-11-05T19:00:00Z")
    const { id: older } = await startGame(app, ben.headers, {
      groupId: family,
      playerIds: [inFamily.Anna, inFamily.Ben],
    })
    app.now = () => new Date("2026-11-05T20:00:00Z")
    const { id: newer } = await startGame(app, anna.headers, {
      groupId: thursday,
      playerIds: [inThursday.Anna, inThursday.Ben],
    })
    // Without Anna: not hers to continue.
    await startGame(app, ben.headers, {
      groupId: thursday,
      playerIds: [inThursday.Ben, inThursday.Dario],
    })
    const { id: cancelled } = await startGame(app, anna.headers, {
      groupId: thursday,
      playerIds: [inThursday.Anna, inThursday.Dario],
    })
    await cancelGame(app, anna.headers, { gameId: cancelled })

    const { runningGames } = await getHome(app, anna.headers)

    expect(
      runningGames.map(({ id, scorekeeper, isScorekeeper }) => ({
        id,
        scorekeeper,
        isScorekeeper,
      }))
    ).toEqual([
      { id: newer, scorekeeper: "Anna", isScorekeeper: true },
      { id: older, scorekeeper: "Ben", isScorekeeper: false },
    ])

    // Ben counts on in the older Game: now it moved last.
    app.now = () => new Date("2026-11-05T21:00:00Z")
    await lose(app, ben.headers, older, [1])
    const again = await getHome(app, anna.headers)
    expect(again.runningGames.map((g) => g.id)).toEqual([older, newer])
    expect(again.runningGames[0].lastActivityAt).toEqual(
      new Date("2026-11-05T21:00:00Z")
    )
  })

  it("starts the next Game in the Group of my latest Game, and tells when each Group last played", async () => {
    const { app, anna, ben, thursday, family, inThursday, inFamily } =
      await setup()
    app.now = () => new Date("2026-11-03T19:00:00Z")
    const { id: played } = await startGame(app, anna.headers, {
      groupId: family,
      playerIds: [inFamily.Anna, inFamily.Ben],
    })
    await lose(app, anna.headers, played, [1, 1, 1, 1])
    app.now = () => new Date("2026-11-05T19:00:00Z")
    const { id: thursdayGame } = await startGame(app, anna.headers, {
      groupId: thursday,
      playerIds: [inThursday.Anna, inThursday.Ben],
    })
    await lose(app, anna.headers, thursdayGame, [1, 1, 1, 1])
    // A cancelled Game is no evening played.
    app.now = () => new Date("2026-11-06T19:00:00Z")
    const { id: cancelled } = await startGame(app, ben.headers, {
      groupId: family,
      playerIds: [inFamily.Ben, inFamily.Anna],
    })
    await cancelGame(app, ben.headers, { gameId: cancelled })

    const home = await getHome(app, anna.headers)

    // Her latest Game was cancelled: not played, like on the Group cards.
    expect(home.newGame).toEqual({
      groupId: thursday,
      groupName: "Donnerstagsrunde",
      lastPlayedAt: new Date("2026-11-05T19:00:00Z"),
    })
    expect((await listHomeGroups(app, anna.headers)).items).toEqual([
      expect.objectContaining({
        id: thursday,
        running: false,
        lastPlayedAt: new Date("2026-11-05T19:00:00Z"),
      }),
      expect.objectContaining({
        id: family,
        running: false,
        lastPlayedAt: new Date("2026-11-03T19:00:00Z"),
      }),
    ])
  })

  it("counts a Game I started without playing in it", async () => {
    const { app, anna, thursday, family, inThursday } = await setup()
    app.now = () => new Date("2026-11-05T19:00:00Z")
    await startGame(app, anna.headers, {
      groupId: thursday,
      playerIds: [inThursday.Ben, inThursday.Dario],
    })

    const home = await getHome(app, anna.headers)

    expect(home.newGame?.groupId).toBe(thursday)
    expect(home.runningGames).toEqual([])
    expect(
      (await listHomeGroups(app, anna.headers)).items.map((g) => g.id)
    ).toEqual([thursday, family])
  })

  it("forgets Groups I have left", async () => {
    const { app, ben, thursday, family, inFamily } = await setup()
    const { id: gameId } = await startGame(app, ben.headers, {
      groupId: family,
      playerIds: [inFamily.Anna, inFamily.Ben],
    })
    await leaveGroup(app, ben.headers, { groupId: family })

    const home = await getHome(app, ben.headers)

    expect(home.runningGames.map((g) => g.id)).not.toContain(gameId)
    expect(home.newGame?.groupId).toBe(thursday)
    expect(
      (await listHomeGroups(app, ben.headers)).items.map((g) => g.id)
    ).toEqual([thursday])
  })

  it("is only for signed-in accounts", async () => {
    const app = await createTestApp()

    await expect(getHome(app, new Headers())).rejects.toMatchObject({
      code: "notSignedIn",
    })
  })
})

describe("Nochmal mit denselben Teilnehmern", () => {
  it("preselects the Players and Seating Order of the given Game", async () => {
    const { app, anna, thursday, inThursday } = await setup()
    const seating = [inThursday.Dario, inThursday.Anna, inThursday.Ben]
    app.now = () => new Date("2026-11-05T19:00:00Z")
    const { id: first } = await startGame(app, anna.headers, {
      groupId: thursday,
      playerIds: seating,
    })
    await lose(app, anna.headers, first, [0, 0, 0, 0, 2, 2, 2])
    // Someone started another Game meanwhile.
    app.now = () => new Date("2026-11-05T21:00:00Z")
    await startGame(app, anna.headers, {
      groupId: thursday,
      playerIds: [inThursday.Ben, inThursday.Anna],
    })

    const again = await getNewGame(app, anna.headers, {
      groupId: thursday,
      fromGame: first,
    })
    const latest = await getNewGame(app, anna.headers, { groupId: thursday })

    expect(again.preselected).toEqual(seating)
    expect(latest.preselected).toEqual([inThursday.Ben, inThursday.Anna])
  })

  it("falls back to the Group's last Game for a Game of another Group", async () => {
    const { app, anna, thursday, family, inThursday, inFamily } = await setup()
    const { id: elsewhere } = await startGame(app, anna.headers, {
      groupId: family,
      playerIds: [inFamily.Ben, inFamily.Anna],
    })
    await startGame(app, anna.headers, {
      groupId: thursday,
      playerIds: [inThursday.Anna, inThursday.Dario],
    })

    const setupFor = await getNewGame(app, anna.headers, {
      groupId: thursday,
      fromGame: elsewhere,
    })

    expect(setupFor.preselected).toEqual([inThursday.Anna, inThursday.Dario])
  })
})
