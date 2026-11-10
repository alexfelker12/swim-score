import { describe, expect, it } from "vitest"
import { getGame, listGames, startGame } from "./games"
import { addGuest, createGroup, getGroup, listMyGroups } from "./groups"
import {
  confirmClaim,
  getGroupManagement,
  getInvite,
  getInviteLink,
  joinGroup,
  linkGuest,
  rejectClaim,
  renewInvite,
} from "./invites"
import { playGame } from "./testing/games"
import { createTestApp, signUp } from "./testing/test-app"
import type { App } from "./app"

/** Anna's Group "Donnerstagsrunde" with the Guests Emil and Hakan; Ben and Mallory have accounts but are not in it. */
async function table() {
  const app = await createTestApp()
  const anna = await signUp(app.auth, { username: "Anna" })
  const ben = await signUp(app.auth, { username: "Ben" })
  const mallory = await signUp(app.auth, { username: "Mallory" })
  const { id: groupId } = await createGroup(app, anna.headers, {
    name: "Donnerstagsrunde",
  })
  await addGuest(app, anna.headers, { groupId, name: "Emil" })
  await addGuest(app, anna.headers, { groupId, name: "Hakan" })
  const { token } = await getInviteLink(app, anna.headers, { groupId })
  return { app, anna, ben, mallory, groupId, token }
}

async function playerIds(app: App, headers: Headers, groupId: string) {
  const group = await getGroup(app, headers, { groupId })
  return Object.fromEntries(group.players.map((p) => [p.name, p.id]))
}

describe("the Invite of a Group", () => {
  it("shows whoever holds it the Group, who invites, and the Guests they could be", async () => {
    const { app, anna, ben, groupId, token } = await table()
    const players = await playerIds(app, anna.headers, groupId)
    await playGame(app, anna.headers, groupId, [players.Anna, players.Emil])

    expect(await getInvite(app, ben.headers, { token })).toEqual({
      groupId,
      groupName: "Donnerstagsrunde",
      invitedBy: "Anna",
      playerCount: 3,
      gameCount: 1,
      alreadyPlayer: false,
      guests: [
        { id: players.Emil, name: "Emil", games: 1 },
        { id: players.Hakan, name: "Hakan", games: 0 },
      ],
    })
  })

  it("tells an account that already plays in the Group so", async () => {
    const { app, anna, token } = await table()

    expect(await getInvite(app, anna.headers, { token })).toMatchObject({
      alreadyPlayer: true,
    })
  })

  it("is a different one for every Group", async () => {
    const { app, anna, token } = await table()
    const other = await createGroup(app, anna.headers, { name: "Montag" })

    const link = await getInviteLink(app, anna.headers, { groupId: other.id })

    expect(link.token).not.toBe(token)
  })

  it("stays valid until the Group Admin renews it; then only the new one works", async () => {
    const { app, anna, ben, mallory, groupId, token } = await table()

    await joinGroup(app, ben.headers, { token })
    const renewed = await renewInvite(app, anna.headers, { groupId })

    expect(renewed.token).not.toBe(token)
    expect(await getInviteLink(app, anna.headers, { groupId })).toEqual(renewed)
    await expect(
      getInvite(app, mallory.headers, { token })
    ).rejects.toMatchObject({ code: "inviteInvalid" })
    await expect(
      joinGroup(app, mallory.headers, { token })
    ).rejects.toMatchObject({ code: "inviteInvalid" })
    await joinGroup(app, mallory.headers, { token: renewed.token })
    const { players } = await getGroup(app, anna.headers, { groupId })
    expect(players.map((p) => p.name)).toContain("Mallory")
  })

  it("refuses a token that never existed", async () => {
    const { app, ben } = await table()

    await expect(
      getInvite(app, ben.headers, { token: "made-up" })
    ).rejects.toMatchObject({ code: "inviteInvalid" })
    await expect(
      joinGroup(app, ben.headers, { token: "made-up" })
    ).rejects.toMatchObject({ code: "inviteInvalid" })
  })

  it.each([
    {
      command: "getInviteLink",
      run: (app: App, headers: Headers, groupId: string) =>
        getInviteLink(app, headers, { groupId }),
    },
    {
      command: "renewInvite",
      run: (app: App, headers: Headers, groupId: string) =>
        renewInvite(app, headers, { groupId }),
    },
  ])("lets only the Group Admin use $command", async ({ run }) => {
    const { app, anna, ben, mallory, groupId, token } = await table()
    await joinGroup(app, ben.headers, { token })

    await expect(run(app, ben.headers, groupId)).rejects.toMatchObject({
      code: "notAdmin",
    })
    await expect(run(app, mallory.headers, groupId)).rejects.toMatchObject({
      code: "groupNotFound",
    })
    expect(await getInviteLink(app, anna.headers, { groupId })).toEqual({
      token,
    })
  })
})

describe("joining via an Invite", () => {
  it("makes the account a new Player of the Group", async () => {
    const { app, anna, ben, groupId, token } = await table()

    expect(await joinGroup(app, ben.headers, { token })).toEqual({ groupId })

    const group = await getGroup(app, ben.headers, { groupId })
    expect(group.isAdmin).toBe(false)
    expect(group.players.find((p) => p.me)).toMatchObject({
      name: "Ben",
      guest: false,
      admin: false,
    })
    expect(await listMyGroups(app, ben.headers)).toEqual([
      { id: groupId, name: "Donnerstagsrunde", playerCount: 4 },
    ])
    expect(
      await getGroupManagement(app, anna.headers, { groupId })
    ).toMatchObject({ claims: [] })
  })

  it("keeps an account to one Player per Group, however often it joins", async () => {
    const { app, anna, ben, groupId, token } = await table()
    const players = await playerIds(app, anna.headers, groupId)

    await joinGroup(app, ben.headers, { token })
    await joinGroup(app, ben.headers, { token })
    await joinGroup(app, ben.headers, { token, guestId: players.Emil })
    expect(await joinGroup(app, anna.headers, { token })).toEqual({ groupId })

    const group = await getGroup(app, anna.headers, { groupId })
    expect(group.players.map((p) => p.name)).toEqual([
      "Anna",
      "Ben",
      "Emil",
      "Hakan",
    ])
    expect(
      await getGroupManagement(app, anna.headers, { groupId })
    ).toMatchObject({ claims: [] })
  })
})

describe("claiming a Guest", () => {
  it("makes the account a Player at once and leaves the Guest alone until the Group Admin decides", async () => {
    const { app, anna, ben, groupId, token } = await table()
    const before = await playerIds(app, anna.headers, groupId)
    await playGame(app, anna.headers, groupId, [before.Anna, before.Emil])

    await joinGroup(app, ben.headers, { token, guestId: before.Emil })

    const players = await playerIds(app, ben.headers, groupId)
    expect(Object.keys(players)).toEqual(["Anna", "Ben", "Emil", "Hakan"])
    const management = await getGroupManagement(app, anna.headers, { groupId })
    expect(management.claims).toEqual([
      { id: expect.any(String), playerId: players.Ben, guestId: players.Emil },
    ])
    expect(management.players).toEqual(
      expect.arrayContaining([
        { id: players.Anna, username: "Anna", games: 1 },
        { id: players.Ben, username: "Ben", games: 0 },
        { id: players.Emil, username: null, games: 1 },
        { id: players.Hakan, username: null, games: 0 },
      ])
    )
  })

  it.each([
    { case: "is not a Player of the Group", guest: "unknown" },
    { case: "is a Player with an account", guest: "Anna" },
  ])("is refused when the claimed Player $case", async ({ guest }) => {
    const { app, anna, ben, groupId, token } = await table()
    const players = await playerIds(app, anna.headers, groupId)

    await expect(
      joinGroup(app, ben.headers, {
        token,
        guestId: players[guest] ?? "does-not-exist",
      })
    ).rejects.toMatchObject({ code: "guestNotFound" })
    const group = await getGroup(app, anna.headers, { groupId })
    expect(group.players.map((p) => p.name)).not.toContain("Ben")
  })

  it("is not open to an account that already plays in the Group", async () => {
    const { app, anna, ben, groupId, token } = await table()
    await joinGroup(app, ben.headers, { token })
    const players = await playerIds(app, anna.headers, groupId)

    await joinGroup(app, ben.headers, { token, guestId: players.Emil })

    const management = await getGroupManagement(app, anna.headers, { groupId })
    expect(management.claims).toEqual([])
    expect(await playerIds(app, anna.headers, groupId)).toEqual(players)
  })

  it("is refused for a Guest of another Group", async () => {
    const { app, anna, ben, token } = await table()
    const other = await createGroup(app, anna.headers, { name: "Montag" })
    const { id: guestId } = await addGuest(app, anna.headers, {
      groupId: other.id,
      name: "Kim",
    })

    await expect(
      joinGroup(app, ben.headers, { token, guestId })
    ).rejects.toMatchObject({ code: "guestNotFound" })
  })
})

describe("confirming a Claim", () => {
  it("gives the account all Games of the Guest, who is gone from the Group", async () => {
    const { app, anna, ben, groupId, token } = await table()
    const before = await playerIds(app, anna.headers, groupId)
    const won = await playGame(app, anna.headers, groupId, [
      before.Emil,
      before.Anna,
    ])
    const lost = await playGame(app, anna.headers, groupId, [
      before.Hakan,
      before.Emil,
    ])
    await joinGroup(app, ben.headers, { token, guestId: before.Emil })
    const [open] = (await getGroupManagement(app, anna.headers, { groupId }))
      .claims

    await confirmClaim(app, anna.headers, { claimId: open.id })

    const players = await playerIds(app, anna.headers, groupId)
    expect(Object.keys(players)).toEqual(["Anna", "Ben", "Hakan"])
    const management = await getGroupManagement(app, anna.headers, { groupId })
    expect(management.claims).toEqual([])
    expect(management.players).toContainEqual({
      id: players.Ben,
      username: "Ben",
      games: 2,
    })
    const first = await getGame(app, ben.headers, { gameId: won })
    expect(first.participants.map((p) => [p.name, p.guest])).toEqual([
      ["Ben", false],
      ["Anna", false],
    ])
    const games = await listGames(app, ben.headers, { groupId })
    expect(games.map((g) => [g.id, g.winner])).toEqual([
      [lost, "Hakan"],
      [won, "Ben"],
    ])
  })

  it("drops the other Claims on that Guest", async () => {
    const { app, anna, ben, mallory, groupId, token } = await table()
    const before = await playerIds(app, anna.headers, groupId)
    await joinGroup(app, ben.headers, { token, guestId: before.Emil })
    await joinGroup(app, mallory.headers, { token, guestId: before.Emil })
    const [first] = (await getGroupManagement(app, anna.headers, { groupId }))
      .claims

    await confirmClaim(app, anna.headers, { claimId: first.id })

    const group = await getGroup(app, anna.headers, { groupId })
    expect(group.players.map((p) => p.name)).toEqual([
      "Anna",
      "Ben",
      "Hakan",
      "Mallory",
    ])
    expect(
      await getGroupManagement(app, anna.headers, { groupId })
    ).toMatchObject({ claims: [] })
  })

  it("is refused when account and Guest have played in the same Game since", async () => {
    const { app, anna, ben, groupId, token } = await table()
    const before = await playerIds(app, anna.headers, groupId)
    await joinGroup(app, ben.headers, { token, guestId: before.Emil })
    const players = await playerIds(app, anna.headers, groupId)
    await startGame(app, anna.headers, {
      groupId,
      playerIds: [players.Anna, players.Ben, players.Emil],
    })
    const [open] = (await getGroupManagement(app, anna.headers, { groupId }))
      .claims

    await expect(
      confirmClaim(app, anna.headers, { claimId: open.id })
    ).rejects.toMatchObject({ code: "playedTogether" })
    expect(Object.keys(await playerIds(app, anna.headers, groupId))).toEqual([
      "Anna",
      "Ben",
      "Emil",
      "Hakan",
    ])
  })
})

describe("rejecting a Claim", () => {
  it("leaves the account a Player and the Guest a Guest with their Games", async () => {
    const { app, anna, ben, groupId, token } = await table()
    const before = await playerIds(app, anna.headers, groupId)
    await playGame(app, anna.headers, groupId, [before.Emil, before.Anna])
    await joinGroup(app, ben.headers, { token, guestId: before.Emil })
    const [open] = (await getGroupManagement(app, anna.headers, { groupId }))
      .claims

    await rejectClaim(app, anna.headers, { claimId: open.id })

    const players = await playerIds(app, anna.headers, groupId)
    const management = await getGroupManagement(app, anna.headers, { groupId })
    expect(management.claims).toEqual([])
    expect(management.players).toEqual(
      expect.arrayContaining([
        { id: players.Ben, username: "Ben", games: 0 },
        { id: players.Emil, username: null, games: 1 },
      ])
    )
  })
})

describe("deciding a Claim", () => {
  it.each([
    { command: "confirmClaim", run: confirmClaim },
    { command: "rejectClaim", run: rejectClaim },
  ])("is only for the Group Admin: $command", async ({ run }) => {
    const { app, anna, ben, mallory, groupId, token } = await table()
    const before = await playerIds(app, anna.headers, groupId)
    await joinGroup(app, ben.headers, { token, guestId: before.Emil })
    const [open] = (await getGroupManagement(app, anna.headers, { groupId }))
      .claims

    await expect(
      run(app, ben.headers, { claimId: open.id })
    ).rejects.toMatchObject({ code: "notAdmin" })
    await expect(
      run(app, mallory.headers, { claimId: open.id })
    ).rejects.toMatchObject({ code: "claimNotFound" })
    await expect(
      run(app, anna.headers, { claimId: "does-not-exist" })
    ).rejects.toMatchObject({ code: "claimNotFound" })
    const management = await getGroupManagement(app, anna.headers, { groupId })
    expect(management.claims).toEqual([open])
  })
})

describe("a Claim that is already decided", () => {
  it.each([
    { first: "rejected", decide: rejectClaim },
    { first: "confirmed", decide: confirmClaim },
  ])("cannot be confirmed once $first", async ({ decide }) => {
    const { app, anna, ben, groupId, token } = await table()
    const before = await playerIds(app, anna.headers, groupId)
    await joinGroup(app, ben.headers, { token, guestId: before.Emil })
    const [open] = (await getGroupManagement(app, anna.headers, { groupId }))
      .claims
    await decide(app, anna.headers, { claimId: open.id })
    const decided = await playerIds(app, anna.headers, groupId)

    await expect(
      confirmClaim(app, anna.headers, { claimId: open.id })
    ).rejects.toMatchObject({ code: "claimNotFound" })
    expect(await playerIds(app, anna.headers, groupId)).toEqual(decided)
  })
})

describe("linking a Guest directly", () => {
  it("merges the Guest into a Player with an account: Games move, the Guest is gone, their open Claim too", async () => {
    const { app, anna, ben, groupId, token } = await table()
    const before = await playerIds(app, anna.headers, groupId)
    const gameId = await playGame(app, anna.headers, groupId, [
      before.Emil,
      before.Anna,
    ])
    await joinGroup(app, ben.headers, { token, guestId: before.Hakan })
    const players = await playerIds(app, anna.headers, groupId)

    await linkGuest(app, anna.headers, {
      groupId,
      guestId: players.Emil,
      playerId: players.Ben,
    })

    expect(Object.keys(await playerIds(app, anna.headers, groupId))).toEqual([
      "Anna",
      "Ben",
      "Hakan",
    ])
    const game = await getGame(app, ben.headers, { gameId })
    expect(game.participants.map((p) => p.name)).toEqual(["Ben", "Anna"])
    expect(await getGroupManagement(app, anna.headers, { groupId })).toEqual({
      players: expect.arrayContaining([
        { id: players.Ben, username: "Ben", games: 1 },
      ]),
      claims: [],
    })
  })

  it("is refused when both sat in the same Game", async () => {
    const { app, anna, ben, groupId, token } = await table()
    await joinGroup(app, ben.headers, { token })
    const players = await playerIds(app, anna.headers, groupId)
    await playGame(app, anna.headers, groupId, [players.Ben, players.Emil])

    await expect(
      linkGuest(app, anna.headers, {
        groupId,
        guestId: players.Emil,
        playerId: players.Ben,
      })
    ).rejects.toMatchObject({ code: "playedTogether" })
  })

  it("is refused for the Group Admin, who is not a Guest of their own Group", async () => {
    const { app, anna, groupId } = await table()
    const players = await playerIds(app, anna.headers, groupId)

    await expect(
      linkGuest(app, anna.headers, {
        groupId,
        guestId: players.Emil,
        playerId: players.Anna,
      })
    ).rejects.toMatchObject({ code: "playerNotFound" })
    expect(await playerIds(app, anna.headers, groupId)).toEqual(players)
  })

  it("only links a Guest to a Player with an account, both of this Group", async () => {
    const { app, anna, ben, groupId, token } = await table()
    await joinGroup(app, ben.headers, { token })
    const players = await playerIds(app, anna.headers, groupId)
    const other = await createGroup(app, anna.headers, { name: "Montag" })
    const { id: kim } = await addGuest(app, anna.headers, {
      groupId: other.id,
      name: "Kim",
    })
    const link = (guestId: string, playerId: string) =>
      linkGuest(app, anna.headers, { groupId, guestId, playerId })

    await expect(link(players.Ben, players.Anna)).rejects.toMatchObject({
      code: "guestNotFound",
    })
    await expect(link(kim, players.Ben)).rejects.toMatchObject({
      code: "guestNotFound",
    })
    await expect(link(players.Emil, players.Hakan)).rejects.toMatchObject({
      code: "playerNotFound",
    })
    await expect(link(players.Emil, "nobody")).rejects.toMatchObject({
      code: "playerNotFound",
    })
  })

  it("is only for the Group Admin, like everything else about managing the Group", async () => {
    const { app, anna, ben, mallory, groupId, token } = await table()
    await joinGroup(app, ben.headers, { token })
    const players = await playerIds(app, anna.headers, groupId)
    const input = { groupId, guestId: players.Emil, playerId: players.Ben }

    await expect(linkGuest(app, ben.headers, input)).rejects.toMatchObject({
      code: "notAdmin",
    })
    await expect(linkGuest(app, mallory.headers, input)).rejects.toMatchObject({
      code: "groupNotFound",
    })
    await expect(
      getGroupManagement(app, ben.headers, { groupId })
    ).rejects.toMatchObject({ code: "notAdmin" })
    await expect(
      getGroupManagement(app, mallory.headers, { groupId })
    ).rejects.toMatchObject({ code: "groupNotFound" })
    expect(Object.keys(await playerIds(app, anna.headers, groupId))).toEqual([
      "Anna",
      "Ben",
      "Emil",
      "Hakan",
    ])
  })
})

describe("every invite command", () => {
  it.each([
    {
      command: "getInviteLink",
      run: (app, headers) => getInviteLink(app, headers, { groupId: "g" }),
    },
    {
      command: "renewInvite",
      run: (app, headers) => renewInvite(app, headers, { groupId: "g" }),
    },
    {
      command: "getInvite",
      run: (app, headers) => getInvite(app, headers, { token: "t" }),
    },
    {
      command: "joinGroup",
      run: (app, headers) => joinGroup(app, headers, { token: "t" }),
    },
    {
      command: "getGroupManagement",
      run: (app, headers) => getGroupManagement(app, headers, { groupId: "g" }),
    },
    {
      command: "confirmClaim",
      run: (app, headers) => confirmClaim(app, headers, { claimId: "c" }),
    },
    {
      command: "rejectClaim",
      run: (app, headers) => rejectClaim(app, headers, { claimId: "c" }),
    },
    {
      command: "linkGuest",
      run: (app, headers) =>
        linkGuest(app, headers, { groupId: "g", guestId: "a", playerId: "b" }),
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
