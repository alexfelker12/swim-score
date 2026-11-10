import { describe, expect, it } from "vitest"
import { addGuest, createGroup, getGroup, listMyGroups } from "./groups"
import { joinViaInvite } from "./testing/groups"
import { createTestApp, signUp } from "./testing/test-app"
import type { App } from "./app"

describe("creating a group", () => {
  it("makes the creator its first Player and its Group Admin", async () => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "Anna" })

    const { id } = await createGroup(app, anna.headers, {
      name: "  Donnerstagsrunde  ",
    })

    expect(await getGroup(app, anna.headers, { groupId: id })).toEqual({
      id,
      name: "Donnerstagsrunde",
      isAdmin: true,
      players: [
        {
          id: expect.any(String),
          name: "Anna",
          image: null,
          guest: false,
          admin: true,
          me: true,
          addedBy: null,
        },
      ],
    })
  })

  it.each([
    { case: "empty", name: "   " },
    { case: "longer than 40 characters", name: "x".repeat(41) },
  ])("refuses a name that is $case", async ({ name }) => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "anna" })

    await expect(
      createGroup(app, anna.headers, { name })
    ).rejects.toMatchObject({ code: "invalidName" })
  })
})

describe("adding a Guest", () => {
  it("lets any Player with an account add a Guest, who becomes a Player and shows who added them", async () => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "Anna" })
    const ben = await signUp(app.auth, { username: "Ben" })
    const { id: groupId } = await createGroup(app, anna.headers, {
      name: "Donnerstagsrunde",
    })
    await joinViaInvite(app, groupId, ben.headers)

    await addGuest(app, ben.headers, { groupId, name: "  Emil " })

    const { players } = await getGroup(app, anna.headers, { groupId })
    expect(players.find((p) => p.name === "Emil")).toEqual({
      id: expect.any(String),
      name: "Emil",
      image: null,
      guest: true,
      admin: false,
      me: false,
      addedBy: "Ben",
    })
  })
})

describe("the Player list", () => {
  it("is sorted by name, accounts and Guests mixed", async () => {
    const app = await createTestApp()
    const dario = await signUp(app.auth, { username: "Dario" })
    const { id: groupId } = await createGroup(app, dario.headers, {
      name: "Donnerstagsrunde",
    })
    for (const name of ["Emil", "ben", "Älex"]) {
      await addGuest(app, dario.headers, { groupId, name })
    }

    const { players } = await getGroup(app, dario.headers, { groupId })

    expect(players.map((p) => p.name)).toEqual(["Älex", "ben", "Dario", "Emil"])
  })
})

describe("a Guest's name", () => {
  it.each([
    { case: "empty", name: "  " },
    { case: "longer than 30 characters", name: "x".repeat(31) },
  ])("is refused when $case", async ({ name }) => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "anna" })
    const { id: groupId } = await createGroup(app, anna.headers, {
      name: "Donnerstagsrunde",
    })

    await expect(
      addGuest(app, anna.headers, { groupId, name })
    ).rejects.toMatchObject({ code: "invalidName" })
  })

  it("is refused when a Player of the Group already has it, ignoring case", async () => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "Anna" })
    const { id: groupId } = await createGroup(app, anna.headers, {
      name: "Donnerstagsrunde",
    })
    await addGuest(app, anna.headers, { groupId, name: "Emil" })

    await expect(
      addGuest(app, anna.headers, { groupId, name: "emil" })
    ).rejects.toMatchObject({ code: "nameTaken" })
    await expect(
      addGuest(app, anna.headers, { groupId, name: "ANNA" })
    ).rejects.toMatchObject({ code: "nameTaken" })
  })

  it("counts a name with different accents as a different name", async () => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "anna" })
    const { id: groupId } = await createGroup(app, anna.headers, {
      name: "Donnerstagsrunde",
    })
    await addGuest(app, anna.headers, { groupId, name: "Zoe" })

    await addGuest(app, anna.headers, { groupId, name: "Zoë" })

    const { players } = await getGroup(app, anna.headers, { groupId })
    expect(players.map((p) => p.name)).toEqual(["anna", "Zoe", "Zoë"])
  })

  it("may repeat a name used in another Group", async () => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "anna" })
    const first = await createGroup(app, anna.headers, { name: "Bauwagen" })
    const second = await createGroup(app, anna.headers, { name: "Montag" })
    await addGuest(app, anna.headers, { groupId: first.id, name: "Emil" })

    await addGuest(app, anna.headers, { groupId: second.id, name: "Emil" })

    const { players } = await getGroup(app, anna.headers, {
      groupId: second.id,
    })
    expect(players.map((p) => p.name)).toContain("Emil")
  })
})

describe("a Group is only visible to its Players", () => {
  it("refuses an account that is not a Player, as if the Group did not exist", async () => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "anna" })
    const mallory = await signUp(app.auth, { username: "mallory" })
    const { id: groupId } = await createGroup(app, anna.headers, {
      name: "Donnerstagsrunde",
    })

    await expect(
      getGroup(app, mallory.headers, { groupId })
    ).rejects.toMatchObject({ code: "groupNotFound" })
    await expect(
      getGroup(app, mallory.headers, { groupId: "does-not-exist" })
    ).rejects.toMatchObject({ code: "groupNotFound" })
  })

  it("does not let an outsider add a Guest", async () => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "anna" })
    const mallory = await signUp(app.auth, { username: "mallory" })
    const { id: groupId } = await createGroup(app, anna.headers, {
      name: "Donnerstagsrunde",
    })

    await expect(
      addGuest(app, mallory.headers, { groupId, name: "Emil" })
    ).rejects.toMatchObject({ code: "groupNotFound" })
    const { players } = await getGroup(app, anna.headers, { groupId })
    expect(players.map((p) => p.name)).toEqual(["anna"])
  })
})

describe("my Groups", () => {
  it("lists the Groups the account plays in, most recently joined first, with their number of Players", async () => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "anna" })
    const ben = await signUp(app.auth, { username: "ben" })
    const bauwagen = await createGroup(app, anna.headers, { name: "Bauwagen" })
    await addGuest(app, anna.headers, { groupId: bauwagen.id, name: "Emil" })
    const montag = await createGroup(app, ben.headers, { name: "Montag" })
    await createGroup(app, ben.headers, { name: "Nur Ben" })
    await joinViaInvite(app, montag.id, anna.headers)

    expect(await listMyGroups(app, anna.headers)).toEqual([
      { id: montag.id, name: "Montag", playerCount: 2 },
      { id: bauwagen.id, name: "Bauwagen", playerCount: 2 },
    ])
  })

  it("is empty for an account without a Group", async () => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "anna" })

    expect(await listMyGroups(app, anna.headers)).toEqual([])
  })
})

describe("every group command", () => {
  it.each([
    {
      command: "createGroup",
      run: (app, headers) => createGroup(app, headers, { name: "X" }),
    },
    {
      command: "getGroup",
      run: (app, headers) => getGroup(app, headers, { groupId: "g" }),
    },
    {
      command: "addGuest",
      run: (app, headers) =>
        addGuest(app, headers, { groupId: "g", name: "X" }),
    },
    { command: "listMyGroups", run: listMyGroups },
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
