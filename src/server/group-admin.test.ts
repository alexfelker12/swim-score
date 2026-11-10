import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { group as groupTable, participant } from "./db/schema"
import { getGame, getNewGame, listGames, startGame } from "./games"
import {
  addGuest,
  createGroup,
  getGroup,
  handOverAdmin,
  leaveGroup,
  listMyGroups,
  removePlayer,
  renameGroup,
} from "./groups"
import { getGroupManagement, getInvite, joinGroup, linkGuest } from "./invites"
import { deleteAccount, getProfile } from "./profile"
import { playGame } from "./testing/games"
import { inviteToken, joinViaInvite } from "./testing/groups"
import { createTestApp, signUp } from "./testing/test-app"
import type { App } from "./app"

/**
 * Anna's Group "Donnerstagsrunde" with Ben and Carla (accounts) and the Guest
 * Emil; Mallory has an account but is not in it.
 */
async function table() {
  const app = await createTestApp()
  const anna = await signUp(app.auth, { username: "Anna" })
  const ben = await signUp(app.auth, { username: "Ben" })
  const carla = await signUp(app.auth, { username: "Carla" })
  const mallory = await signUp(app.auth, { username: "Mallory" })
  const { id: groupId } = await createGroup(app, anna.headers, {
    name: "Donnerstagsrunde",
  })
  await joinViaInvite(app, groupId, ben.headers)
  await joinViaInvite(app, groupId, carla.headers)
  await addGuest(app, anna.headers, { groupId, name: "Emil" })
  const ids = await playerIds(app, anna.headers, groupId)
  return { app, anna, ben, carla, mallory, groupId, ids }
}

async function playerIds(app: App, headers: Headers, groupId: string) {
  const group = await getGroup(app, headers, { groupId })
  return Object.fromEntries(group.players.map((p) => [p.name, p.id]))
}

async function names(app: App, headers: Headers, groupId: string) {
  const group = await getGroup(app, headers, { groupId })
  return {
    players: group.players.map((p) => p.name),
    former: group.formerPlayers.map((p) => `${p.name} (${p.reason})`),
  }
}

describe("renaming a Group", () => {
  it("is for the Group Admin, with the same rules as a new name", async () => {
    const { app, anna, ben, mallory, groupId } = await table()

    await renameGroup(app, anna.headers, { groupId, name: "  Montagsrunde " })

    expect((await getGroup(app, ben.headers, { groupId })).name).toBe(
      "Montagsrunde"
    )
    await expect(
      renameGroup(app, anna.headers, { groupId, name: " " })
    ).rejects.toMatchObject({ code: "invalidName" })
    await expect(
      renameGroup(app, ben.headers, { groupId, name: "Bens Runde" })
    ).rejects.toMatchObject({ code: "notAdmin" })
    await expect(
      renameGroup(app, mallory.headers, { groupId, name: "Meins" })
    ).rejects.toMatchObject({ code: "groupNotFound" })
  })
})

describe("removing a Player", () => {
  it("makes them a Former Player who no longer sees the Group", async () => {
    const { app, anna, ben, groupId, ids } = await table()

    await removePlayer(app, anna.headers, { groupId, playerId: ids.Ben })

    expect(await names(app, anna.headers, groupId)).toEqual({
      players: ["Anna", "Carla", "Emil"],
      former: ["Ben (removed)"],
    })
    const [former] = (await getGroup(app, anna.headers, { groupId }))
      .formerPlayers
    expect(former).toEqual({
      id: ids.Ben,
      name: "Ben",
      reason: "removed",
      leftAt: expect.any(Date),
    })
    await expect(getGroup(app, ben.headers, { groupId })).rejects.toMatchObject(
      { code: "groupNotFound" }
    )
    expect(await listMyGroups(app, ben.headers)).toEqual([])
    expect(await listMyGroups(app, anna.headers)).toEqual([
      { id: groupId, name: "Donnerstagsrunde", playerCount: 3 },
    ])
  })

  it("leaves their past Games and summaries exactly as they were", async () => {
    const { app, anna, groupId, ids } = await table()
    const gameId = await playGame(app, anna.headers, groupId, [
      ids.Ben,
      ids.Emil,
    ])
    const before = await getGame(app, anna.headers, { gameId })
    const listed = await listGames(app, anna.headers, { groupId })

    await removePlayer(app, anna.headers, { groupId, playerId: ids.Ben })
    await removePlayer(app, anna.headers, { groupId, playerId: ids.Emil })

    expect(await getGame(app, anna.headers, { gameId })).toEqual(before)
    expect(await listGames(app, anna.headers, { groupId })).toEqual(listed)
  })

  it("takes them out of the choice for new Games, the last Seating Order included", async () => {
    const { app, anna, groupId, ids } = await table()
    await playGame(app, anna.headers, groupId, [ids.Anna, ids.Ben])

    await removePlayer(app, anna.headers, { groupId, playerId: ids.Ben })

    const newGame = await getNewGame(app, anna.headers, { groupId })
    expect(newGame.players.map((p) => p.name)).toEqual([
      "Anna",
      "Carla",
      "Emil",
    ])
    expect(newGame.preselected).toEqual([ids.Anna])
    await expect(
      startGame(app, anna.headers, {
        groupId,
        playerIds: [ids.Anna, ids.Ben],
      })
    ).rejects.toMatchObject({ code: "unknownPlayer" })
  })

  it("works for Guests, who can then neither be claimed nor linked", async () => {
    const { app, anna, mallory, groupId, ids } = await table()

    await removePlayer(app, anna.headers, { groupId, playerId: ids.Emil })

    const token = await inviteToken(app, groupId)
    expect((await getInvite(app, mallory.headers, { token })).guests).toEqual(
      []
    )
    await expect(
      joinGroup(app, mallory.headers, { token, guestId: ids.Emil })
    ).rejects.toMatchObject({ code: "guestNotFound" })
    await expect(
      linkGuest(app, anna.headers, {
        groupId,
        guestId: ids.Emil,
        playerId: ids.Ben,
      })
    ).rejects.toMatchObject({ code: "guestNotFound" })
  })

  it("drops a Claim by or for the removed Player", async () => {
    const { app, anna, mallory, groupId, ids } = await table()
    const token = await inviteToken(app, groupId)
    const dora = await signUp(app.auth, { username: "Dora" })
    await joinGroup(app, mallory.headers, { token, guestId: ids.Emil })
    await joinGroup(app, dora.headers, { token, guestId: ids.Emil })
    const claims = async () =>
      (await getGroupManagement(app, anna.headers, { groupId })).claims

    const { Mallory } = await playerIds(app, anna.headers, groupId)
    await removePlayer(app, anna.headers, { groupId, playerId: Mallory })
    expect(await claims()).toHaveLength(1)

    await removePlayer(app, anna.headers, { groupId, playerId: ids.Emil })
    expect(await claims()).toEqual([])
  })

  it("is only for the Group Admin, and not for the Group Admin themselves", async () => {
    const { app, anna, ben, mallory, groupId, ids } = await table()
    const remove = (headers: Headers, playerId: string) =>
      removePlayer(app, headers, { groupId, playerId })

    await expect(remove(ben.headers, ids.Carla)).rejects.toMatchObject({
      code: "notAdmin",
    })
    await expect(remove(mallory.headers, ids.Carla)).rejects.toMatchObject({
      code: "groupNotFound",
    })
    await expect(remove(anna.headers, ids.Anna)).rejects.toMatchObject({
      code: "adminCannotLeave",
    })
    await expect(remove(anna.headers, "nobody")).rejects.toMatchObject({
      code: "playerNotFound",
    })
    await remove(anna.headers, ids.Carla)
    await expect(remove(anna.headers, ids.Carla)).rejects.toMatchObject({
      code: "playerNotFound",
    })
  })
})

describe("leaving a Group", () => {
  it("makes the Player a Former Player; their Games stay", async () => {
    const { app, anna, ben, groupId, ids } = await table()
    const gameId = await playGame(app, anna.headers, groupId, [
      ids.Ben,
      ids.Anna,
    ])
    const before = await getGame(app, anna.headers, { gameId })

    await leaveGroup(app, ben.headers, { groupId })

    expect(await names(app, anna.headers, groupId)).toEqual({
      players: ["Anna", "Carla", "Emil"],
      former: ["Ben (left)"],
    })
    expect(await getGame(app, anna.headers, { gameId })).toEqual(before)
    await expect(
      leaveGroup(app, ben.headers, { groupId })
    ).rejects.toMatchObject({ code: "groupNotFound" })
  })

  it("is refused for the Group Admin, who hands over the role first", async () => {
    const { app, anna, groupId } = await table()

    await expect(
      leaveGroup(app, anna.headers, { groupId })
    ).rejects.toMatchObject({ code: "adminCannotLeave" })
  })

  it("can be undone by joining via the Invite again, as the same Player", async () => {
    const { app, anna, ben, groupId, ids } = await table()
    const gameId = await playGame(app, anna.headers, groupId, [
      ids.Ben,
      ids.Anna,
    ])
    await leaveGroup(app, ben.headers, { groupId })

    await joinViaInvite(app, groupId, ben.headers)

    expect(await names(app, anna.headers, groupId)).toEqual({
      players: ["Anna", "Ben", "Carla", "Emil"],
      former: [],
    })
    expect((await playerIds(app, ben.headers, groupId)).Ben).toBe(ids.Ben)
    const game = await getGame(app, ben.headers, { gameId })
    expect(game.participants[0]).toMatchObject({ playerId: ids.Ben })
  })
})

describe("handing over the Group Admin role", () => {
  it("makes another Player with an account the Group Admin", async () => {
    const { app, anna, ben, groupId, ids } = await table()

    await handOverAdmin(app, anna.headers, { groupId, playerId: ids.Ben })

    expect((await getGroup(app, ben.headers, { groupId })).isAdmin).toBe(true)
    const group = await getGroup(app, anna.headers, { groupId })
    expect(group.isAdmin).toBe(false)
    expect(group.players.find((p) => p.admin)?.name).toBe("Ben")
    await leaveGroup(app, anna.headers, { groupId })
  })

  it("only goes to a current Player with an account other than the Group Admin", async () => {
    const { app, anna, ben, carla, groupId, ids } = await table()
    await leaveGroup(app, carla.headers, { groupId })
    const handOver = (headers: Headers, playerId: string) =>
      handOverAdmin(app, headers, { groupId, playerId })

    for (const playerId of [ids.Emil, ids.Anna, ids.Carla, "nobody"]) {
      await expect(handOver(anna.headers, playerId)).rejects.toMatchObject({
        code: "playerNotFound",
      })
    }
    await expect(handOver(ben.headers, ids.Ben)).rejects.toMatchObject({
      code: "notAdmin",
    })
  })
})

describe("deleting an account", () => {
  it("turns the account into an anonymous Former Player in every Group, numbered per Group", async () => {
    const { app, anna, ben, carla, groupId } = await table()
    const montag = await createGroup(app, anna.headers, { name: "Montag" })
    await joinViaInvite(app, montag.id, carla.headers)

    await deleteAccount(app, ben.headers)
    await deleteAccount(app, carla.headers)

    expect(await names(app, anna.headers, groupId)).toEqual({
      players: ["Anna", "Emil"],
      former: [
        "Ehemaliger Spieler 1 (deleted)",
        "Ehemaliger Spieler 2 (deleted)",
      ],
    })
    expect(await names(app, anna.headers, montag.id)).toEqual({
      players: ["Anna"],
      former: ["Ehemaliger Spieler 1 (deleted)"],
    })
  })

  it("changes nothing in past Games but the name", async () => {
    const { app, anna, ben, groupId, ids } = await table()
    const gameId = await playGame(app, anna.headers, groupId, [
      ids.Ben,
      ids.Anna,
    ])
    const before = await getGame(app, anna.headers, { gameId })
    const [listed] = await listGames(app, anna.headers, { groupId })

    await deleteAccount(app, ben.headers)

    expect(await getGame(app, anna.headers, { gameId })).toEqual({
      ...before,
      participants: before.participants.map((p) =>
        p.playerId === ids.Ben ? { ...p, name: "Ehemaliger Spieler 1" } : p
      ),
    })
    expect(await listGames(app, anna.headers, { groupId })).toEqual([
      { ...listed, winner: "Ehemaliger Spieler 1" },
    ])
  })

  it("leaves a running Game it kept score of without a Scorekeeper", async () => {
    const { app, anna, ben, groupId, ids } = await table()
    const { id: gameId } = await startGame(app, ben.headers, {
      groupId,
      playerIds: [ids.Ben, ids.Anna],
    })

    await deleteAccount(app, ben.headers)

    expect(await getGame(app, anna.headers, { gameId })).toMatchObject({
      status: "running",
      scorekeeper: null,
      isScorekeeper: false,
    })
  })

  it("removes name, picture, e-mail and sign-in, so the username is free again", async () => {
    const { app, ben, groupId } = await table()

    await deleteAccount(app, ben.headers)

    await expect(getProfile(app, ben.headers)).rejects.toMatchObject({
      code: "notSignedIn",
    })
    await expect(
      app.auth.api.signInUsername({
        body: { username: "Ben", password: "geheim123" },
      })
    ).rejects.toBeDefined()
    const newBen = await signUp(app.auth, { username: "Ben" })
    await expect(
      getGroup(app, newBen.headers, { groupId })
    ).rejects.toMatchObject({ code: "groupNotFound" })
  })

  it("also anonymises a Player who had already left", async () => {
    const { app, anna, ben, groupId } = await table()
    await leaveGroup(app, ben.headers, { groupId })

    await deleteAccount(app, ben.headers)

    expect((await names(app, anna.headers, groupId)).former).toEqual([
      "Ehemaliger Spieler 1 (deleted)",
    ])
  })

  it("is refused while the account is Group Admin of a Group with other accounts", async () => {
    const { app, anna, groupId, ids } = await table()

    await expect(deleteAccount(app, anna.headers)).rejects.toMatchObject({
      code: "stillAdmin",
    })
    expect((await getProfile(app, anna.headers)).name).toBe("Anna")

    await handOverAdmin(app, anna.headers, { groupId, playerId: ids.Ben })
    await deleteAccount(app, anna.headers)
  })

  it("takes along a Group in which no other account ever played", async () => {
    const { app, mallory } = await table()
    const solo = await createGroup(app, mallory.headers, { name: "Allein" })
    const { id: kim } = await addGuest(app, mallory.headers, {
      groupId: solo.id,
      name: "Kim",
    })
    const me = (await playerIds(app, mallory.headers, solo.id)).Mallory
    await playGame(app, mallory.headers, solo.id, [me, kim])

    await deleteAccount(app, mallory.headers)

    expect(
      await app.db.query.group.findFirst({ where: eq(groupTable.id, solo.id) })
    ).toBeUndefined()
  })

  it("keeps a Group without a Group Admin when only Former Players have accounts there, for their past Games", async () => {
    const { app, anna, ben, carla, groupId, ids } = await table()
    const gameId = await playGame(app, anna.headers, groupId, [
      ids.Ben,
      ids.Carla,
    ])
    await removePlayer(app, anna.headers, { groupId, playerId: ids.Ben })
    await leaveGroup(app, carla.headers, { groupId })
    const token = await inviteToken(app, groupId)

    await deleteAccount(app, anna.headers)

    const kept = await app.db.query.group.findFirst({
      where: eq(groupTable.id, groupId),
      columns: { adminId: true },
    })
    expect(kept).toEqual({ adminId: null })
    expect(
      await app.db.$count(participant, eq(participant.gameId, gameId))
    ).toBe(2)
    // Nobody can come back into a Group that nobody manages.
    await expect(getInvite(app, ben.headers, { token })).rejects.toMatchObject({
      code: "inviteInvalid",
    })
    await expect(joinGroup(app, ben.headers, { token })).rejects.toMatchObject({
      code: "inviteInvalid",
    })
    expect(await listMyGroups(app, ben.headers)).toEqual([])
  })
})

describe("every group admin command", () => {
  it.each([
    {
      command: "renameGroup",
      run: (app, headers) =>
        renameGroup(app, headers, { groupId: "g", name: "x" }),
    },
    {
      command: "removePlayer",
      run: (app, headers) =>
        removePlayer(app, headers, { groupId: "g", playerId: "p" }),
    },
    {
      command: "leaveGroup",
      run: (app, headers) => leaveGroup(app, headers, { groupId: "g" }),
    },
    {
      command: "handOverAdmin",
      run: (app, headers) =>
        handOverAdmin(app, headers, { groupId: "g", playerId: "p" }),
    },
    {
      command: "deleteAccount",
      run: (app, headers) => deleteAccount(app, headers),
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
