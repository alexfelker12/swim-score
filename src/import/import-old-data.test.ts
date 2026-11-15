import { eq } from "drizzle-orm"
import sharp from "sharp"
import { describe, expect, it } from "vitest"
import { replay } from "@/rules-engine"
import {
  account,
  avatar,
  game,
  gameEvent,
  group,
  participant,
  player,
  user,
} from "../server/db/schema"
import { getGame } from "../server/games"
import { getGroup } from "../server/groups"
import { getLeaderboard } from "../server/leaderboard"
import { createTestApp, signInWithGoogle } from "../server/testing/test-app"
import { OLD_RULE_SET, convertGame } from "./convert-game"
import fixtures from "./fixtures/old-games.json"
import { importOldData } from "./import-old-data"
import { createOldDatabase } from "./testing/old-database"
import type { OldRound } from "./convert-game"
import type { ImportOptions } from "./import-old-data"
import type { OldGame, OldTracker, OldUser } from "./testing/old-database"

const BLOB = "https://abc.public.blob.vercel-storage.com/avatars/anna.png"
const GOOGLE_PICTURE = "https://lh3.googleusercontent.com/a/carl=s96-c"

/**
 * A real Game of the old app (`fixtures/old-games.json`, by index) with
 * these Participants in place of p1, p2, … (old order).
 */
function realGame(
  index: number,
  id: string,
  people: Array<{ userId: string } | { guest: string }>,
  extra: Partial<OldGame> = {}
): OldGame {
  const fixture = fixtures[index]
  const ids = people.map((_, i) => `${id}-part-${i + 1}`)
  const swap = (p: string | null | undefined) =>
    p ? ids[Number(p.slice(1)) - 1] : p
  return {
    id,
    status: fixture.status as OldGame["status"],
    participants: people.map((p, i) => ({
      id: ids[i],
      userId: "userId" in p ? p.userId : null,
      displayName: "userId" in p ? p.userId.slice(2) : p.guest,
    })),
    rounds: (fixture.rounds as Array<OldRound>).map((r) => ({
      round: r.round,
      data: {
        ...r.data,
        players: r.data.players.map((p) => ({ ...p, id: swap(p.id)! })),
        ...(r.data.playerSwimming !== undefined && {
          playerSwimming: swap(r.data.playerSwimming),
        }),
        ...(r.data.nukeBy && { nukeBy: swap(r.data.nukeBy) }),
        ...(r.data.dealer !== undefined && { dealer: swap(r.data.dealer)! }),
      },
    })),
    ...extra,
  }
}

const users: Array<OldUser> = [
  {
    id: "u-anna",
    name: "Anna",
    email: "anna@beispiel.de",
    username: "anna",
    displayUsername: "Anna",
    password: "altes-passwort",
    image: BLOB,
  },
  // Signed up with Google: the old app gave no username.
  {
    id: "u-ben",
    name: "Ben Müller",
    email: "ben.mueller@beispiel.de",
    googleSub: "google-ben",
  },
  {
    id: "u-f",
    name: "F",
    email: "f@beispiel.de",
    username: "f",
    displayUsername: "F",
    password: "f-passwort",
    googleSub: "google-f",
  },
  {
    id: "u-carl",
    name: "Carl Heinz",
    email: "carl@beispiel.de",
    // With a space at the end, as typed.
    username: "carl heinz ",
    displayUsername: "Carl Heinz ",
    googleSub: "google-carl",
    image: GOOGLE_PICTURE,
  },
  // Only in the running Game of Bauwagen, which is not imported.
  {
    id: "u-ida",
    name: "Ida",
    email: "ida@beispiel.de",
    username: "ida",
    password: "ida-passwort",
  },
  // Only in a Tracker that is not imported.
  {
    id: "u-dora",
    name: "Dora",
    email: "dora@beispiel.de",
    username: "dora",
    password: "dora-passwort",
  },
]

const bauwagen: OldTracker = {
  id: "cm0bauwagen000000000000001",
  displayName: "Bauwagen",
  creatorId: "u-anna",
  createdAt: new Date("2025-04-20T18:00:00Z"),
  players: [
    { id: "tp-anna", userId: "u-anna" },
    { id: "tp-ben", userId: "u-ben" },
    { id: "tp-f", userId: "u-f" },
    { id: "tp-carl", userId: "u-carl" },
    { id: "tp-emil", guest: "Emil" },
  ],
  games: [
    realGame(
      0,
      "cm0game000000000000000001",
      [
        { userId: "u-anna" },
        { userId: "u-ben" },
        { userId: "u-f" },
        { userId: "u-carl" },
        { guest: "Emil" },
      ],
      {
        createdAt: new Date("2025-06-05T19:00:00Z"),
        updatedAt: new Date("2025-06-05T20:10:00Z"),
      }
    ),
    // Gustav played once and is no Player of the Tracker any more.
    realGame(
      3,
      "cm0game000000000000000002",
      [
        { userId: "u-anna" },
        { userId: "u-ben" },
        { userId: "u-f" },
        { userId: "u-carl" },
        { guest: "Emil" },
        { guest: "Gustav" },
      ],
      {
        createdAt: new Date("2025-06-12T19:00:00Z"),
        updatedAt: new Date("2025-06-12T19:30:00Z"),
      }
    ),
    realGame(
      5,
      "cm0game000000000000000003",
      [
        { userId: "u-anna" },
        { userId: "u-ben" },
        { userId: "u-f" },
        { userId: "u-ida" },
      ],
      { status: "ACTIVE" }
    ),
  ],
}

const montagsschillen: OldTracker = {
  id: "cm0montag0000000000000001",
  displayName: "Montagsschillen",
  creatorId: "u-ben",
  players: [
    { id: "tp-m-ben", userId: "u-ben" },
    { id: "tp-m-f", userId: "u-f" },
    { id: "tp-m-emil", guest: "Emil" },
    { id: "tp-m-hanna", guest: "Hanna" },
  ],
  games: [
    realGame(5, "cm0game000000000000000004", [
      { userId: "u-ben" },
      { userId: "u-f" },
      { guest: "Emil" },
      { guest: "Hanna" },
    ]),
  ],
}

const beiLen: OldTracker = {
  id: "cm0beilen0000000000000001",
  displayName: "Bei Len",
  creatorId: "u-dora",
  players: [
    { id: "tp-l-dora", userId: "u-dora" },
    { id: "tp-l-anna", userId: "u-anna" },
  ],
  games: [
    realGame(5, "cm0game000000000000000005", [
      { userId: "u-dora" },
      { userId: "u-anna" },
      { guest: "X" },
      { guest: "Y" },
    ]),
  ],
}

/** A 600 × 400 px PNG, as an uploaded profile picture. */
const picture = sharp({
  create: { width: 600, height: 400, channels: 3, background: "#147a93" },
})
  .png()
  .toBuffer()

async function setup(options: Partial<ImportOptions> = {}) {
  const old = await createOldDatabase({
    users,
    trackers: [bauwagen, montagsschillen, beiLen],
  })
  const app = await createTestApp()
  const report = await importOldData(app.db, old, {
    trackers: ["Bauwagen", "Montagsschillen"],
    fetchImage: async (url) =>
      url === BLOB ? new Uint8Array(await picture) : null,
    ...options,
  })
  const signIn = (username: string, password: string) =>
    app.auth.api.signInUsername({
      body: { username, password },
      asResponse: true,
    })
  return { app, report, signIn }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe("importing the old app's data", () => {
  it("makes each named Tracker a Group, its creator the Group Admin", async () => {
    const { app } = await setup()

    const groups = await app.db
      .select({ id: group.id, name: group.name, adminId: group.adminId })
      .from(group)
      .orderBy(group.name)

    expect(groups).toEqual([
      { id: expect.stringMatching(UUID), name: "Bauwagen", adminId: "u-anna" },
      {
        id: expect.stringMatching(UUID),
        name: "Montagsschillen",
        adminId: "u-ben",
      },
    ])
  })

  it("takes over only the accounts that play in them, keeping their ids", async () => {
    const { app } = await setup()

    const accounts = await app.db
      .select({ id: user.id, email: user.email })
      .from(user)
      .orderBy(user.id)

    expect(accounts.map((a) => a.id)).toEqual([
      "u-anna",
      "u-ben",
      "u-carl",
      "u-f",
    ])
  })

  it("keeps passwords: accounts sign in as before", async () => {
    const { signIn } = await setup()

    expect((await signIn("anna", "altes-passwort")).ok).toBe(true)
    expect((await signIn("anna", "falsch-123")).ok).toBe(false)
    expect((await signIn("dora", "dora-passwort")).ok).toBe(false)
  })

  it("keeps the link to Google: the same Google account signs in to the imported account", async () => {
    const { app } = await setup()

    const { user: signedIn } = await signInWithGoogle(app.auth, {
      sub: "google-carl",
      email: "carl@beispiel.de",
      name: "Carl Heinz",
    })

    expect(signedIn.id).toBe("u-carl")
    expect(await app.db.select().from(user)).toHaveLength(4)
  })

  it("makes usernames fit the new rules, and says which it changed", async () => {
    const { app, report, signIn } = await setup()

    const names = await app.db
      .select({
        id: user.id,
        username: user.username,
        displayUsername: user.displayUsername,
      })
      .from(user)
      .orderBy(user.id)

    expect(names).toEqual([
      { id: "u-anna", username: "anna", displayUsername: "Anna" },
      // From the e-mail address, like a new Google sign-up.
      { id: "u-ben", username: "ben.mueller", displayUsername: "ben.mueller" },
      { id: "u-carl", username: "carl_heinz", displayUsername: "Carl_Heinz" },
      // Too short for the new minimum of 3.
      { id: "u-f", username: "f__", displayUsername: "F__" },
    ])
    expect(report.usernames).toEqual([
      { name: "Ben Müller", from: null, to: "ben.mueller" },
      { name: "Carl Heinz", from: "Carl Heinz ", to: "Carl_Heinz" },
      { name: "F", from: "F", to: "F__" },
    ])
    expect((await signIn("F__", "f-passwort")).ok).toBe(true)
  })

  it("adds the Players, Guests as Guests of their Group", async () => {
    const { app } = await setup()
    const [bauwagenId] = (
      await app.db
        .select({ id: group.id })
        .from(group)
        .where(eq(group.name, "Bauwagen"))
    ).map((g) => g.id)

    const anna = await app.auth.api.signInUsername({
      body: { username: "anna", password: "altes-passwort" },
      asResponse: true,
    })
    const headers = new Headers({
      cookie: anna.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    })
    const view = await getGroup(app, headers, { groupId: bauwagenId })

    expect(view.players.map((p) => ({ name: p.name, guest: p.guest }))).toEqual(
      [
        { name: "Anna", guest: false },
        { name: "Ben Müller", guest: false },
        { name: "Carl Heinz", guest: false },
        { name: "Emil", guest: true },
        { name: "F", guest: false },
      ]
    )
    // A Guest who played but is no Player any more: a Former Player.
    const former = await app.db
      .select({ name: player.name, leftAt: player.leftAt })
      .from(player)
      .where(eq(player.groupId, bauwagenId))
    expect(former.filter((p) => p.leftAt !== null)).toEqual([
      { name: "Gustav", leftAt: new Date("2025-06-12T19:30:00Z") },
    ])
    const guests = await app.db
      .select({ name: player.name, createdById: player.createdById })
      .from(player)
      .where(eq(player.name, "Emil"))
    expect(guests).toEqual([
      { name: "Emil", createdById: "u-anna" },
      { name: "Emil", createdById: "u-ben" },
    ])
  })

  it("turns finished and cancelled Games into Events that replay to the old snapshots; running ones stay behind", async () => {
    const { app, report } = await setup()

    const games = await app.db
      .select({
        id: game.id,
        status: game.status,
        version: game.version,
        startedAt: game.startedAt,
        finishedAt: game.finishedAt,
        scorekeeperId: game.scorekeeperId,
      })
      .from(game)
      .orderBy(game.startedAt)

    expect(games).toEqual([
      // Montagsschillen's, dated like its Tracker in this test.
      expect.objectContaining({
        status: "finished",
        startedAt: new Date("2025-06-01T18:00:00Z"),
      }),
      expect.objectContaining({
        status: "finished",
        startedAt: new Date("2025-06-05T19:00:00Z"),
        finishedAt: new Date("2025-06-05T20:10:00Z"),
        scorekeeperId: "u-anna",
      }),
      expect.objectContaining({
        status: "cancelled",
        startedAt: new Date("2025-06-12T19:00:00Z"),
        finishedAt: new Date("2025-06-12T19:30:00Z"),
      }),
    ])
    expect(games.every((g) => UUID.test(g.id))).toBe(true)
    expect(report.groups).toEqual([
      expect.objectContaining({
        name: "Bauwagen",
        finished: 1,
        cancelled: 1,
        skippedRunning: 1,
      }),
      expect.objectContaining({
        name: "Montagsschillen",
        finished: 1,
        cancelled: 0,
        skippedRunning: 0,
      }),
    ])

    // Each Game's Events are exactly those of the conversion.
    for (const [old, stored] of [
      [bauwagen.games[0], games[1]],
      [bauwagen.games[1], games[2]],
    ] as const) {
      const converted = convertGame(old.rounds)
      const seats = await app.db
        .select({ id: participant.id, seat: participant.seat })
        .from(participant)
        .where(eq(participant.gameId, stored.id))
        .orderBy(participant.seat)
      const events = await app.db
        .select({ version: gameEvent.version, event: gameEvent.event })
        .from(gameEvent)
        .where(eq(gameEvent.gameId, stored.id))
        .orderBy(gameEvent.version)
      const newId = new Map(
        converted.seating.map((oldId, seat) => [oldId, seats[seat].id])
      )
      const rename = (id: string) => newId.get(id)!
      expect(events.map((e) => e.event)).toEqual(
        converted.events.map((e) =>
          e.type === "lost"
            ? { ...e, loser: rename(e.loser) }
            : e.type === "bomb"
              ? {
                  ...e,
                  thrower: rename(e.thrower),
                  ...(e.swimmer && { swimmer: rename(e.swimmer) }),
                }
              : e
        )
      )
      expect(events.map((e) => e.version)).toEqual(events.map((_, i) => i + 1))
      // Cancelling was a change of its own.
      expect(stored.version).toBe(
        events.length + (stored.status === "cancelled" ? 1 : 0)
      )
    }
  })

  it("writes the summaries of finished Games, so they count for statistics", async () => {
    const { app, signIn } = await setup()
    const response = await signIn("anna", "altes-passwort")
    const headers = new Headers({
      cookie: response.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    })
    const [{ id: groupId }] = await app.db
      .select({ id: group.id })
      .from(group)
      .where(eq(group.name, "Bauwagen"))

    const { metrics } = await getLeaderboard(app, headers, { groupId })
    const games = metrics.find((m) => m.id === "games")!
    const wins = metrics.find((m) => m.id === "wins")!

    // One finished Game with all five (the cancelled one does not count).
    expect(games.ranked.map((r) => [r.name, r.value])).toEqual([
      ["Anna", 1],
      ["Ben Müller", 1],
      ["Carl Heinz", 1],
      ["Emil", 1],
      ["F", 1],
    ])
    // The old winner of that Game was p1: Anna.
    expect(wins.ranked[0]).toMatchObject({ name: "Anna", value: 1, rank: 1 })

    const [finished] = await app.db
      .select({ id: game.id })
      .from(game)
      .where(eq(game.startedAt, new Date("2025-06-05T19:00:00Z")))
    const view = await getGame(app, headers, { gameId: finished.id })
    const old = convertGame(bauwagen.games[0].rounds)
    expect(view.state).toMatchObject({
      finished: true,
      round: replay(OLD_RULE_SET, old.seating, old.events).round,
    })
  })

  it("takes over profile pictures from Vercel Blob; Google pictures stay links", async () => {
    const { app, report } = await setup()

    const [anna] = await app.db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, "u-anna"))
    const [stored] = await app.db
      .select()
      .from(avatar)
      .where(eq(avatar.userId, "u-anna"))
    const [carl] = await app.db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, "u-carl"))

    expect(anna.image).toMatch(/^\/api\/avatar\/u-anna\?v=\d+$/)
    expect(stored.contentType).toBe("image/webp")
    expect(await sharp(stored.data).metadata()).toMatchObject({
      width: 256,
      height: 256,
    })
    // The picture is wider than high: the middle square, editable later.
    expect(stored.crop).toEqual({ x: 1 / 6, y: 0, size: 1 })
    expect(stored.source).not.toBeNull()
    expect(carl.image).toBe(GOOGLE_PICTURE)
    expect(report.avatars).toEqual({ imported: 1, failed: [] })
  })

  it("goes on without a picture that cannot be loaded, and says whose", async () => {
    const { app, report } = await setup({ fetchImage: async () => null })

    const [anna] = await app.db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, "u-anna"))

    expect(anna.image).toBeNull()
    expect(await app.db.select().from(avatar)).toEqual([])
    expect(report.avatars).toEqual({ imported: 0, failed: ["Anna"] })
  })

  it("writes nothing on a dry run, but reports all the same", async () => {
    const wet = await setup()
    const dry = await setup({ dryRun: true })

    expect(dry.report).toEqual(wet.report)
    expect(await dry.app.db.select().from(user)).toEqual([])
    expect(await dry.app.db.select().from(game)).toEqual([])
  })

  it("only imports into an empty database", async () => {
    const { app } = await setup()
    const old = await createOldDatabase({ users, trackers: [bauwagen] })

    await expect(
      importOldData(app.db, old, {
        trackers: ["Bauwagen"],
        fetchImage: async () => null,
      })
    ).rejects.toThrow(/empty/)
  })

  it("is repeatable: two imports into empty databases give the same ids", async () => {
    const first = await setup()
    const second = await setup()

    const ids = async (db: typeof first.app.db) => ({
      groups: (
        await db.select({ id: group.id }).from(group).orderBy(group.id)
      ).map((g) => g.id),
      games: (await db.select({ id: game.id }).from(game).orderBy(game.id)).map(
        (g) => g.id
      ),
      accounts: (
        await db.select({ id: account.id }).from(account).orderBy(account.id)
      ).map((a) => a.id),
    })

    expect(await ids(second.app.db)).toEqual(await ids(first.app.db))
  })

  it("refuses names that are no Tracker of the old app", async () => {
    const old = await createOldDatabase({ users, trackers: [bauwagen] })
    const app = await createTestApp()

    await expect(
      importOldData(app.db, old, {
        trackers: ["Bauwagen", "Gibtsnicht"],
        fetchImage: async () => null,
      })
    ).rejects.toThrow(/Gibtsnicht/)
    expect(await app.db.select().from(user)).toEqual([])
  })
})
