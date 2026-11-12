import { describe, expect, it } from "vitest"
import { cancelGame, getGame, recordEvent, startGame } from "./games"
import { addGuest, createGroup, getGroup, leaveGroup } from "./groups"
import { getLeaderboard } from "./leaderboard"
import { joinViaInvite } from "./testing/groups"
import { createTestApp, signUp } from "./testing/test-app"
import type { MetricId } from "./leaderboard"
import type { TestApp } from "./testing/test-app"

/** Anna's Group with Ben and Carla (accounts) and the Guest Dario. */
async function table() {
  const app = await createTestApp()
  const anna = await signUp(app.auth, { username: "Anna" })
  const ben = await signUp(app.auth, { username: "Ben" })
  const carla = await signUp(app.auth, { username: "Carla" })
  const { id: groupId } = await createGroup(app, anna.headers, {
    name: "Donnerstagsrunde",
  })
  await joinViaInvite(app, groupId, ben.headers)
  await joinViaInvite(app, groupId, carla.headers)
  await addGuest(app, anna.headers, { groupId, name: "Dario" })
  const group = await getGroup(app, anna.headers, { groupId })
  const players = Object.fromEntries(group.players.map((p) => [p.name, p.id]))
  return { app, anna, ben, carla, groupId, players }
}

type Step = { lost: number } | { bomb: number; swimmer?: number }

/**
 * Plays a Game with these Players in this Seating Order, recorded by
 * `headers`; steps name Participants by their seat. Returns its id.
 */
async function play(
  app: TestApp,
  headers: Headers,
  groupId: string,
  playerIds: Array<string>,
  steps: Array<Step>
) {
  const { id: gameId } = await startGame(app, headers, { groupId, playerIds })
  const { participants } = await getGame(app, headers, { gameId })
  const seat = (i: number) => participants[i].id
  for (const [version, step] of steps.entries()) {
    await recordEvent(app, headers, {
      gameId,
      expectedVersion: version,
      event:
        "lost" in step
          ? { type: "lost", loser: seat(step.lost) }
          : {
              type: "bomb",
              thrower: seat(step.bomb),
              ...(step.swimmer === undefined
                ? {}
                : { swimmer: seat(step.swimmer) }),
            },
    })
  }
  return gameId
}

/** Two players: the first wins without losing a Life; the second swims. */
const firstWinsClean: Array<Step> = [
  { lost: 1 },
  { lost: 1 },
  { lost: 1 },
  { lost: 1 },
]

/** Two players: the first swims and still wins. */
const firstWinsAsSwimmer: Array<Step> = [
  { lost: 0 },
  { lost: 0 },
  { lost: 0 },
  // Ben cannot swim any more: Out after his third.
  { lost: 1 },
  { lost: 1 },
  { lost: 1 },
]

/** Two players: the first bombs twice, then the second loses twice more. */
const firstWinsWithBombs: Array<Step> = [
  { bomb: 0 },
  { bomb: 0 },
  { lost: 1 },
  { lost: 1 },
]

async function board(
  app: TestApp,
  headers: Headers,
  groupId: string,
  metric: MetricId,
  period: { from?: string; to?: string } = {}
) {
  const leaderboard = await getLeaderboard(app, headers, {
    groupId,
    ...period,
  })
  const found = leaderboard.metrics.find((m) => m.id === metric)
  if (!found) throw new Error(`No metric ${metric}`)
  return found
}

/** The ranked rows as "rank name value detail", for compact assertions. */
function lines(metric: Awaited<ReturnType<typeof board>>) {
  return metric.ranked.map(
    (r) => `${r.rank} ${r.name} ${+r.value.toFixed(4)} ${r.detail}`
  )
}

describe("the Group Leaderboard", () => {
  it("offers the start metrics in their order, each with its definition", async () => {
    const { app, anna, groupId } = await table()

    const { metrics } = await getLeaderboard(app, anna.headers, { groupId })

    expect(
      metrics.map(({ id, name, description, unit, minGames }) => ({
        id,
        name,
        description,
        unit,
        minGames,
      }))
    ).toEqual([
      {
        id: "wins",
        name: "Siege",
        description: "Meiste Siege",
        unit: "count",
        minGames: null,
      },
      {
        id: "winRate",
        name: "Winrate",
        description: "Siege pro Spiel, ab 5 Spielen",
        unit: "percent",
        minGames: 5,
      },
      {
        id: "games",
        name: "Teilnahmen",
        description: "Meiste Spiele",
        unit: "count",
        minGames: null,
      },
      {
        id: "bombsPerGame",
        name: "Bomben pro Spiel",
        description: "Ab 5 Spielen",
        unit: "decimal",
        minGames: 5,
      },
      {
        id: "swimRate",
        name: "Schwimmer-Quote",
        description: "Wie oft geschwommen, ab 5 Spielen",
        unit: "percent",
        minGames: 5,
      },
      {
        id: "unbreakable",
        name: "Unbreakable",
        description: "Siege als Schwimmer",
        unit: "count",
        minGames: null,
      },
      {
        id: "untouchable",
        name: "Untouchable",
        description: "Siege ohne verlorenes Leben",
        unit: "count",
        minGames: null,
      },
    ])
  })

  it("is empty before any Game finished", async () => {
    const { app, anna, groupId } = await table()

    const leaderboard = await getLeaderboard(app, anna.headers, { groupId })

    expect(leaderboard.since).toBeNull()
    expect(leaderboard.years).toEqual([])
    expect(leaderboard.metrics.every((m) => m.ranked.length === 0)).toBe(true)
  })

  it("Siege: ranks by wins, players with equal values share the place", async () => {
    const { app, anna, groupId, players } = await table()
    const { Anna, Ben, Carla } = players
    await play(app, anna.headers, groupId, [Anna, Ben], firstWinsClean)
    await play(app, anna.headers, groupId, [Ben, Carla], firstWinsClean)
    await play(app, anna.headers, groupId, [Anna, Carla], firstWinsClean)
    await play(app, anna.headers, groupId, [Ben, Anna], firstWinsClean)

    const wins = await board(app, anna.headers, groupId, "wins")

    expect(lines(wins)).toEqual([
      "1 Anna 2 aus 3 Spielen",
      "1 Ben 2 aus 3 Spielen",
      "3 Carla 0 aus 2 Spielen",
    ])
    expect(wins.pending).toEqual([])
  })

  it("Teilnahmen: ranks by Games played", async () => {
    const { app, anna, groupId, players } = await table()
    const { Anna, Ben, Carla } = players
    await play(app, anna.headers, groupId, [Anna, Ben], firstWinsClean)
    await play(app, anna.headers, groupId, [Ben, Carla], firstWinsClean)
    await play(app, anna.headers, groupId, [Ben, Anna], firstWinsClean)

    const games = await board(app, anna.headers, groupId, "games")

    expect(lines(games)).toEqual([
      "1 Ben 3 Spiele",
      "2 Anna 2 Spiele",
      "3 Carla 1 Spiel",
    ])
  })

  it("Winrate: wins per Game, players under 5 Games are not ranked yet", async () => {
    const { app, anna, groupId, players } = await table()
    const { Anna, Ben, Carla, Dario } = players
    // Anna: 5 Games, 4 wins. Ben: 5 Games, 1 win. Dario: 4 of 4, Carla: 0 of 4.
    for (let i = 0; i < 4; i++) {
      await play(app, anna.headers, groupId, [Anna, Carla], firstWinsClean)
      await play(app, anna.headers, groupId, [Dario, Ben], firstWinsClean)
    }
    await play(app, anna.headers, groupId, [Ben, Anna], firstWinsClean)

    const winRate = await board(app, anna.headers, groupId, "winRate")

    expect(lines(winRate)).toEqual(["1 Anna 0.8 4 von 5", "2 Ben 0.2 1 von 5"])
    expect(winRate.pending).toEqual([
      { playerId: Carla, name: "Carla", guest: false, games: 4 },
      { playerId: Dario, name: "Dario", guest: true, games: 4 },
    ])
  })

  it("Bomben pro Spiel: Bombs thrown per Game, from 5 Games", async () => {
    const { app, anna, groupId, players } = await table()
    const { Anna, Ben } = players
    await play(app, anna.headers, groupId, [Anna, Ben], firstWinsWithBombs)
    await play(app, anna.headers, groupId, [Ben, Anna], firstWinsWithBombs)
    await play(app, anna.headers, groupId, [Ben, Anna], firstWinsWithBombs)
    for (let i = 0; i < 2; i++) {
      await play(app, anna.headers, groupId, [Anna, Ben], firstWinsClean)
    }

    const bombs = await board(app, anna.headers, groupId, "bombsPerGame")

    expect(lines(bombs)).toEqual(["1 Ben 0.8 4 Bomben", "2 Anna 0.4 2 Bomben"])
  })

  it("Schwimmer-Quote: how often a player was the Swimmer, from 5 Games", async () => {
    const { app, anna, groupId, players } = await table()
    const { Anna, Ben } = players
    // Ben swims as the loser four times; Anna swims once and wins.
    for (let i = 0; i < 4; i++) {
      await play(app, anna.headers, groupId, [Anna, Ben], firstWinsClean)
    }
    await play(app, anna.headers, groupId, [Anna, Ben], firstWinsAsSwimmer)

    const swims = await board(app, anna.headers, groupId, "swimRate")

    expect(lines(swims)).toEqual(["1 Ben 0.8 4 von 5", "2 Anna 0.2 1 von 5"])
  })

  it("Unbreakable: wins as the Swimmer", async () => {
    const { app, anna, groupId, players } = await table()
    const { Anna, Ben } = players
    await play(app, anna.headers, groupId, [Anna, Ben], firstWinsAsSwimmer)
    await play(app, anna.headers, groupId, [Ben, Anna], firstWinsClean)

    const unbreakable = await board(app, anna.headers, groupId, "unbreakable")

    expect(lines(unbreakable)).toEqual([
      "1 Anna 1 als Schwimmer gewonnen",
      "2 Ben 0 als Schwimmer gewonnen",
    ])
  })

  it("Untouchable: wins without losing a single Life", async () => {
    const { app, anna, groupId, players } = await table()
    const { Anna, Ben } = players
    await play(app, anna.headers, groupId, [Anna, Ben], firstWinsClean)
    await play(app, anna.headers, groupId, [Anna, Ben], firstWinsClean)
    await play(app, anna.headers, groupId, [Ben, Anna], firstWinsAsSwimmer)
    // Ben wins after losing a Life: not untouchable.
    await play(
      app,
      anna.headers,
      groupId,
      [Ben, Anna],
      [{ lost: 0 }, ...firstWinsClean]
    )

    const untouchable = await board(app, anna.headers, groupId, "untouchable")

    expect(lines(untouchable)).toEqual([
      "1 Anna 2 ohne Lebensverlust",
      "2 Ben 0 ohne Lebensverlust",
    ])
  })

  it("counts Guests, but neither Former Players nor cancelled or running Games", async () => {
    const { app, anna, carla, groupId, players } = await table()
    const { Anna, Carla, Dario } = players
    await play(app, anna.headers, groupId, [Dario, Anna], firstWinsClean)
    await play(app, anna.headers, groupId, [Carla, Anna], firstWinsClean)
    const cancelled = await play(
      app,
      anna.headers,
      groupId,
      [Anna, Dario],
      [{ lost: 1 }]
    )
    await cancelGame(app, anna.headers, { gameId: cancelled })
    await play(app, anna.headers, groupId, [Anna, Dario], [{ lost: 1 }])
    await leaveGroup(app, carla.headers, { groupId })

    const wins = await board(app, anna.headers, groupId, "wins")

    expect(wins.ranked).toEqual([
      expect.objectContaining({ name: "Dario", guest: true, value: 1 }),
      expect.objectContaining({ name: "Anna", guest: false, value: 0 }),
    ])
    expect(wins.ranked[1].detail).toBe("aus 2 Spielen")
  })

  it("limits the Games to a period by the day they started, German time", async () => {
    const { app, anna, groupId, players } = await table()
    const { Anna, Ben } = players
    // 31 Dec 2024, 23:30 in Berlin is still 2024 there.
    app.now = () => new Date("2024-12-31T22:30:00Z")
    await play(app, anna.headers, groupId, [Anna, Ben], firstWinsClean)
    app.now = () => new Date("2025-03-01T12:00:00Z")
    await play(app, anna.headers, groupId, [Ben, Anna], firstWinsClean)
    app.now = () => new Date("2026-06-30T21:00:00Z")
    await play(app, anna.headers, groupId, [Ben, Anna], firstWinsClean)

    const all = await getLeaderboard(app, anna.headers, { groupId })
    expect(all.since).toEqual(new Date("2024-12-31T22:30:00Z"))
    expect(all.years).toEqual([2026, 2025, 2024])

    const in2024 = await board(app, anna.headers, groupId, "wins", {
      from: "2024-01-01",
      to: "2024-12-31",
    })
    expect(lines(in2024)).toEqual([
      "1 Anna 1 aus 1 Spiel",
      "2 Ben 0 aus 1 Spiel",
    ])

    const custom = await board(app, anna.headers, groupId, "wins", {
      from: "2025-03-01",
      to: "2026-06-30",
    })
    expect(lines(custom)).toEqual([
      "1 Ben 2 aus 2 Spielen",
      "2 Anna 0 aus 2 Spielen",
    ])
  })

  it("refuses a period that is not one", async () => {
    const { app, anna, groupId } = await table()

    for (const period of [
      { from: "2026-07-01", to: "2026-06-30" },
      { from: "gestern", to: "2026-06-30" },
      { from: "2026-02-30", to: "2026-03-01" },
      { from: "2026-01-01" },
    ]) {
      await expect(
        getLeaderboard(app, anna.headers, { groupId, ...period })
      ).rejects.toMatchObject({ code: "invalidPeriod" })
    }
  })

  it("is only for the Group's Players", async () => {
    const { app, carla, groupId } = await table()
    const outsider = await signUp(app.auth, { username: "Erik" })
    await leaveGroup(app, carla.headers, { groupId })

    for (const headers of [outsider.headers, carla.headers]) {
      await expect(
        getLeaderboard(app, headers, { groupId })
      ).rejects.toMatchObject({ code: "groupNotFound" })
    }
    await expect(
      getLeaderboard(app, new Headers(), { groupId })
    ).rejects.toMatchObject({ code: "notSignedIn" })
  })
})
