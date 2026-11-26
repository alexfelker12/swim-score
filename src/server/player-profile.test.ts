import { describe, expect, it } from "vitest"
import { cancelGame, getGame, recordEvent, startGame } from "./games"
import { createGroup, getGroup, leaveGroup } from "./groups"
import { getPlayerProfile } from "./player-profile"
import { joinViaInvite } from "./testing/groups"
import { createTestApp, signUp } from "./testing/test-app"
import type { PlayerProfile } from "./player-profile"
import type { TestApp } from "./testing/test-app"

/**
 * Anna, Ben and Carla play in "Donnerstagsrunde"; Ben also plays in
 * "Familie am See" with Dora, without Anna. Erik shares no Group with anyone.
 */
async function circles() {
  const app = await createTestApp()
  const [anna, ben, carla, dora, erik] = await Promise.all(
    ["Anna", "Ben", "Carla", "Dora", "Erik"].map((username) =>
      signUp(app.auth, { username })
    )
  )
  const { id: thursday } = await createGroup(app, anna.headers, {
    name: "Donnerstagsrunde",
  })
  await joinViaInvite(app, thursday, ben.headers)
  await joinViaInvite(app, thursday, carla.headers)
  const { id: family } = await createGroup(app, ben.headers, {
    name: "Familie am See",
  })
  await joinViaInvite(app, family, dora.headers)
  const ids = async (headers: Headers, groupId: string) =>
    Object.fromEntries(
      (await getGroup(app, headers, { groupId })).players.map((p) => [
        p.name,
        p.id,
      ])
    )
  return {
    app,
    anna,
    ben,
    carla,
    dora,
    erik,
    thursday,
    family,
    inThursday: await ids(anna.headers, thursday),
    inFamily: await ids(ben.headers, family),
  }
}

/**
 * Two players: the first wins without losing a Life, the second swims
 * and goes Out. Returns the Game's id.
 */
async function win(
  app: TestApp,
  headers: Headers,
  groupId: string,
  [winner, loser]: [string, string]
) {
  const { id: gameId } = await startGame(app, headers, {
    groupId,
    playerIds: [winner, loser],
  })
  const { participants } = await getGame(app, headers, { gameId })
  for (let version = 0; version < 4; version++) {
    await recordEvent(app, headers, {
      gameId,
      expectedVersion: version,
      event: { type: "lost", loser: participants[1].id },
    })
  }
  return gameId
}

function totals(profile: PlayerProfile) {
  return Object.fromEntries(profile.totals.map((t) => [t.id, t.value]))
}

describe("Player Profile", () => {
  it("shows the own Personal Stats over all Groups and per Group", async () => {
    const { app, ben, thursday, family, inThursday, inFamily } = await circles()
    await win(app, ben.headers, thursday, [inThursday.Ben, inThursday.Anna])
    await win(app, ben.headers, thursday, [inThursday.Anna, inThursday.Ben])
    await win(app, ben.headers, family, [inFamily.Ben, inFamily.Dora])

    const profile = await getPlayerProfile(app, ben.headers, {
      userId: ben.user.id,
    })

    expect(profile).toMatchObject({ name: "Ben", isMe: true, groupCount: 2 })
    expect(profile.totals.map((t) => t.name)).toEqual([
      "Teilnahmen",
      "Siege",
      "Winrate",
      "Bomben pro Spiel",
      "Schwimmer-Quote",
      "Unbreakable",
      "Untouchable",
    ])
    expect(totals(profile)).toMatchObject({
      games: 3,
      wins: 2,
      winRate: 2 / 3,
      bombsPerGame: 0,
      swimRate: 1 / 3,
      unbreakable: 0,
      untouchable: 2,
    })
    expect(profile.groups).toEqual([
      {
        groupId: thursday,
        name: "Donnerstagsrunde",
        games: 2,
        winRate: 0.5,
        swimRate: 0.5,
        bombsPerGame: 0,
      },
      {
        groupId: family,
        name: "Familie am See",
        games: 1,
        winRate: 1,
        swimRate: 0,
        bombsPerGame: 0,
      },
    ])
  })

  it("shows another account's totals over all their Groups, but only shared Groups apart", async () => {
    const { app, anna, ben, thursday, family, inThursday, inFamily } =
      await circles()
    await win(app, ben.headers, thursday, [inThursday.Ben, inThursday.Anna])
    await win(app, ben.headers, family, [inFamily.Ben, inFamily.Dora])
    await win(app, ben.headers, family, [inFamily.Dora, inFamily.Ben])
    const benId = ben.user.id

    const profile = await getPlayerProfile(app, anna.headers, {
      userId: benId,
    })

    expect(profile).toMatchObject({
      userId: benId,
      name: "Ben",
      isMe: false,
      // Only the account itself sees how many Groups it plays in.
      groupCount: null,
    })
    expect(totals(profile)).toMatchObject({ games: 3, wins: 2 })
    expect(profile.groups).toEqual([
      {
        groupId: thursday,
        name: "Donnerstagsrunde",
        games: 1,
        winRate: 1,
        swimRate: 0,
        bombsPerGame: 0,
      },
    ])
  })

  it("is only visible to accounts sharing a Group, besides the account itself", async () => {
    const { app, anna, carla, erik, thursday } = await circles()
    const annaId = anna.user.id

    // Erik shares no Group with Anna; he still sees his own profile.
    await expect(
      getPlayerProfile(app, erik.headers, { userId: annaId })
    ).rejects.toMatchObject({ code: "playerNotFound" })
    await expect(
      getPlayerProfile(app, erik.headers, {
        userId: erik.user.id,
      })
    ).resolves.toMatchObject({
      isMe: true,
      groupCount: 0,
      groups: [],
      since: null,
      // A rate without any Game has no value.
      totals: expect.arrayContaining([
        expect.objectContaining({ id: "winRate", value: null }),
      ]),
    })

    // A Former Player no longer shares the Group, in either direction.
    await leaveGroup(app, carla.headers, { groupId: thursday })
    await expect(
      getPlayerProfile(app, carla.headers, { userId: annaId })
    ).rejects.toMatchObject({ code: "playerNotFound" })
    await expect(
      getPlayerProfile(app, anna.headers, {
        userId: carla.user.id,
      })
    ).rejects.toMatchObject({ code: "playerNotFound" })

    await expect(
      getPlayerProfile(app, anna.headers, { userId: "unknown" })
    ).rejects.toMatchObject({ code: "playerNotFound" })
    await expect(
      getPlayerProfile(app, new Headers(), { userId: annaId })
    ).rejects.toMatchObject({ code: "notSignedIn" })
  })

  it("counts no cancelled Games, but still the Games in Groups the account has left", async () => {
    const { app, ben, dora, family, thursday, inThursday, inFamily } =
      await circles()
    await win(app, ben.headers, thursday, [inThursday.Ben, inThursday.Anna])
    const { id: cancelled } = await startGame(app, ben.headers, {
      groupId: thursday,
      playerIds: [inThursday.Ben, inThursday.Carla],
    })
    await cancelGame(app, ben.headers, { gameId: cancelled })
    await win(app, dora.headers, family, [inFamily.Dora, inFamily.Ben])
    await leaveGroup(app, dora.headers, { groupId: family })
    const doraId = dora.user.id
    const benId = ben.user.id

    const bens = await getPlayerProfile(app, ben.headers, { userId: benId })
    expect(totals(bens)).toMatchObject({ games: 2, wins: 1 })

    // Dora left "Familie am See": no Group card, but her win there stays hers.
    const doras = await getPlayerProfile(app, dora.headers, {
      userId: doraId,
    })
    expect(doras).toMatchObject({ groupCount: 0, groups: [] })
    expect(doras.since).not.toBeNull()
    expect(totals(doras)).toMatchObject({ games: 1, wins: 1, winRate: 1 })
  })

  it("limits totals and Groups to the period, and offers the years with Games", async () => {
    const { app, anna, ben, thursday, family, inThursday, inFamily } =
      await circles()
    app.now = () => new Date("2024-03-07T19:00:00Z")
    await win(app, ben.headers, thursday, [inThursday.Ben, inThursday.Anna])
    app.now = () => new Date("2026-02-01T19:00:00Z")
    await win(app, ben.headers, family, [inFamily.Ben, inFamily.Dora])
    const benId = ben.user.id

    const all = await getPlayerProfile(app, anna.headers, { userId: benId })
    expect(all.since).toEqual(new Date("2024-03-07T19:00:00Z"))
    expect(all.years).toEqual([2026, 2024])

    const in2026 = await getPlayerProfile(app, anna.headers, {
      userId: benId,
      from: "2026-01-01",
      to: "2026-12-31",
    })
    expect(totals(in2026)).toMatchObject({ games: 1, wins: 1 })
    expect(in2026.groups).toEqual([
      expect.objectContaining({ name: "Donnerstagsrunde", games: 0 }),
    ])

    await expect(
      getPlayerProfile(app, anna.headers, {
        userId: benId,
        from: "2026-12-31",
        to: "2026-01-01",
      })
    ).rejects.toMatchObject({ code: "invalidPeriod" })
  })
})
