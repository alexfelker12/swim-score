import { createHash } from "node:crypto"
import { count } from "drizzle-orm"
import { usernameFromEmail } from "../server/auth"
import {
  account,
  avatar,
  game,
  gameEvent,
  group,
  newInviteToken,
  participant,
  player,
  user,
} from "../server/db/schema"
import { summarize } from "../server/games"
import { avatarUrl } from "../server/profile"
import { prepareAvatar } from "./avatar"
import { OLD_RULE_SET, convertGame } from "./convert-game"
import type { GameEvent } from "@/rules-engine"
import type { Database } from "../server/db"
import type { OldRound } from "./convert-game"

// One-off import of the old app (score-tracker) into the new model (#17):
// the named Trackers become Groups, with their Players, Guests and the
// Games that were finished or cancelled. See README › "Alte Daten".

/** The old app's Postgres, read through plain SQL. */
export type OldDatabase = {
  query: <T>(text: string, params?: Array<unknown>) => Promise<Array<T>>
}

export type ImportOptions = {
  /** `displayName`s of the Trackers to import, each becoming a Group. */
  trackers: ReadonlyArray<string>
  /** Loads a profile picture from Vercel Blob; null when it cannot. */
  fetchImage: (url: string) => Promise<Uint8Array | null>
  /** Does everything, then rolls it back: only the report remains. */
  dryRun?: boolean
}

export type ImportReport = {
  groups: Array<{
    name: string
    players: number
    guests: number
    formerPlayers: number
    finished: number
    cancelled: number
    /** Games still running in the old app; they are not imported. */
    skippedRunning: number
  }>
  accounts: number
  /** Usernames that had to change to fit the new rules (by Display Name). */
  usernames: Array<{ name: string; from: string | null; to: string }>
  avatars: { imported: number; failed: Array<string> }
}

/**
 * The id an old record gets in the new model: a UUID like the new app's
 * own, derived from the old cuid, so that importing twice gives the same
 * ids. Accounts keep theirs: better-auth made them in both apps.
 */
function importedId(oldId: string): string {
  const hash = createHash("sha1").update(`swim-score/import/${oldId}`).digest()
  hash[6] = (hash[6] & 0x0f) | 0x50 // version 5 (name-based, SHA-1)
  hash[8] = (hash[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = hash.subarray(0, 16).toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

type OldTrackerRow = {
  id: string
  displayName: string
  creatorId: string | null
  createdAt: Date
}
type OldTrackerPlayerRow = {
  id: string
  displayName: string
  trackerId: string
  playerId: string | null
}
type OldGameRow = {
  id: string
  trackerId: string
  status: "ACTIVE" | "COMPLETED" | "CANCELLED"
  createdAt: Date
  updatedAt: Date
}
type OldParticipantRow = {
  id: string
  gameId: string
  userId: string | null
  displayName: string
}
type OldUserRow = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  username: string | null
  displayUsername: string | null
  createdAt: Date
  updatedAt: Date
}
type OldAccountRow = {
  id: string
  accountId: string
  providerId: string
  userId: string
  accessToken: string | null
  refreshToken: string | null
  idToken: string | null
  accessTokenExpiresAt: Date | null
  refreshTokenExpiresAt: Date | null
  scope: string | null
  password: string | null
  createdAt: Date
  updatedAt: Date
}

// The old columns are timestamps without time zone, written in UTC: read
// them as UTC, whatever the time zone of the machine running the import.
const utc = (column: string) => `"${column}" at time zone 'UTC' as "${column}"`

/**
 * Imports the named Trackers with everything they need into an empty
 * database, in one transaction: nothing is written unless all of it is.
 */
export async function importOldData(
  db: Database,
  old: OldDatabase,
  options: ImportOptions
): Promise<ImportReport> {
  const data = await readOld(old, options.trackers)
  const plan = planImport(data)
  const avatars = await loadAvatars(plan.users, options.fetchImage)

  const rollback = new Error("dry run")
  await db
    .transaction(async (tx) => {
      const [{ users: existing }] = await tx
        .select({ users: count() })
        .from(user)
      const [{ groups: existingGroups }] = await tx
        .select({ groups: count() })
        .from(group)
      if (existing > 0 || existingGroups > 0) {
        throw new Error(
          "The new database is not empty: the import only writes into an empty one."
        )
      }
      await tx.insert(user).values(
        plan.users.map((u) => ({
          ...u.row,
          image: avatars.images.get(u.row.id) ?? u.keptImage,
        }))
      )
      if (data.accounts.length > 0) {
        await tx.insert(account).values(
          data.accounts.map((a) => ({
            ...a,
            // Google sign-in issues new ones; old tokens are not worth copying.
            accessToken: null,
            refreshToken: null,
            idToken: null,
            accessTokenExpiresAt: null,
            refreshTokenExpiresAt: null,
          }))
        )
      }
      if (avatars.rows.length > 0) await tx.insert(avatar).values(avatars.rows)
      await tx.insert(group).values(plan.groups)
      await tx.insert(player).values(plan.players)
      for (const g of plan.games) {
        await tx.insert(game).values(g.game)
        await tx.insert(participant).values(g.participants)
        if (g.events.length > 0) await tx.insert(gameEvent).values(g.events)
      }
      if (options.dryRun) throw rollback
    })
    .catch((error: unknown) => {
      if (error !== rollback) throw error
    })

  return {
    groups: plan.report,
    accounts: plan.users.length,
    usernames: plan.usernames,
    avatars: { imported: avatars.rows.length, failed: avatars.failed },
  }
}

type OldData = Awaited<ReturnType<typeof readOld>>

async function readOld(old: OldDatabase, names: ReadonlyArray<string>) {
  const trackers = await old.query<OldTrackerRow>(
    `select id, "displayName", "creatorId", ${utc("createdAt")}
     from "Tracker" where type = 'SCHWIMMEN' and "displayName" = any($1)
     order by "createdAt"`,
    [names]
  )
  const missing = names.filter(
    (name) => !trackers.some((t) => t.displayName === name)
  )
  if (missing.length > 0) {
    throw new Error(`No Tracker in the old database: ${missing.join(", ")}`)
  }
  const twice = names.filter(
    (name) => trackers.filter((t) => t.displayName === name).length > 1
  )
  if (twice.length > 0) {
    throw new Error(`Several Trackers have the name: ${twice.join(", ")}`)
  }
  const trackerIds = trackers.map((t) => t.id)
  const trackerPlayers = await old.query<OldTrackerPlayerRow>(
    `select id, "displayName", "trackerId", "playerId" from "TrackerPlayer"
     where "trackerId" = any($1) order by id`,
    [trackerIds]
  )
  const games = await old.query<OldGameRow>(
    `select id, "trackerId", status, ${utc("createdAt")}, ${utc("updatedAt")}
     from "Game" where "trackerId" = any($1) order by "createdAt", id`,
    [trackerIds]
  )
  const gameIds = games.map((g) => g.id)
  const imported = new Set(
    games.filter((g) => g.status !== "ACTIVE").map((g) => g.id)
  )
  const participants = await old.query<OldParticipantRow>(
    `select id, "gameId", "userId", "displayName" from "GameParticipant"
     where "gameId" = any($1) order by id`,
    [gameIds]
  )
  const rounds = await old.query<{ gameId: string } & OldRound>(
    `select "gameId", round, data from "GameRound" where "gameId" = any($1)
     order by "gameId", round`,
    [gameIds]
  )
  const userIds = [
    ...new Set([
      ...trackers.flatMap((t) => (t.creatorId ? [t.creatorId] : [])),
      ...trackerPlayers.flatMap((p) => (p.playerId ? [p.playerId] : [])),
      // Running Games are not imported, nor who only played there.
      ...participants.flatMap((p) =>
        p.userId && imported.has(p.gameId) ? [p.userId] : []
      ),
    ]),
  ]
  const users = await old.query<OldUserRow>(
    `select id, name, email, "emailVerified", image, username, "displayUsername",
       ${utc("createdAt")}, ${utc("updatedAt")}
     from "user" where id = any($1) order by id`,
    [userIds]
  )
  const accounts = await old.query<OldAccountRow>(
    `select id, "accountId", "providerId", "userId", "accessToken", "refreshToken",
       "idToken", ${utc("accessTokenExpiresAt")}, ${utc("refreshTokenExpiresAt")},
       scope, password, ${utc("createdAt")}, ${utc("updatedAt")}
     from account where "userId" = any($1) order by id`,
    [userIds]
  )
  return {
    trackers,
    trackerPlayers,
    games,
    participants,
    rounds,
    users,
    accounts,
  }
}

type PlannedUser = {
  row: typeof user.$inferInsert
  /** The old picture where it stays a link (Google), else null. */
  keptImage: string | null
  /** A picture to take over from Vercel Blob. */
  blobImage: string | null
}

/** Everything to write, in the new model, before anything is written. */
function planImport(data: OldData) {
  const { users, usernames } = planUsers(data.users)
  const groups: Array<typeof group.$inferInsert> = []
  const players: Array<typeof player.$inferInsert> = []
  const games: Array<{
    game: typeof game.$inferInsert
    participants: Array<typeof participant.$inferInsert>
    events: Array<typeof gameEvent.$inferInsert>
  }> = []
  const report: ImportReport["groups"] = []

  for (const tracker of data.trackers) {
    // The Group Admin is a Player with an account (CONTEXT.md).
    const creatorPlays = data.trackerPlayers.some(
      (p) => p.trackerId === tracker.id && p.playerId === tracker.creatorId
    )
    if (!tracker.creatorId || !creatorPlays) {
      throw new Error(
        `Tracker ${tracker.displayName}: its creator is no Player of it, so there is no Group Admin`
      )
    }
    const groupId = importedId(tracker.id)
    groups.push({
      id: groupId,
      name: tracker.displayName,
      adminId: tracker.creatorId,
      inviteToken: newInviteToken(),
      createdAt: tracker.createdAt,
    })
    const trackerGames = data.games.filter((g) => g.trackerId === tracker.id)
    const imported = trackerGames.filter((g) => g.status !== "ACTIVE")

    // Players of the Tracker: accounts by account, Guests by name.
    const byUser = new Map<string, string>()
    const byGuest = new Map<string, string>()
    for (const tp of data.trackerPlayers.filter(
      (p) => p.trackerId === tracker.id
    )) {
      const id = importedId(tp.id)
      players.push({
        id,
        groupId,
        userId: tp.playerId,
        name: tp.playerId ? null : tp.displayName,
        createdById: tp.playerId ? null : tracker.creatorId,
        createdAt: tracker.createdAt,
      })
      if (tp.playerId) byUser.set(tp.playerId, id)
      else byGuest.set(tp.displayName, id)
    }
    const current = players.length

    // Who played but is no Player of the Tracker any more: a Former Player,
    // gone after their last Game there.
    const lastGame = new Map<string, Date>()
    for (const g of imported) {
      for (const p of data.participants.filter((x) => x.gameId === g.id)) {
        const key = p.userId ?? `guest:${p.displayName}`
        const known = p.userId
          ? byUser.has(p.userId)
          : byGuest.has(p.displayName)
        if (!known) lastGame.set(key, g.updatedAt)
      }
    }
    for (const [key, leftAt] of lastGame) {
      const guest = key.startsWith("guest:") ? key.slice(6) : null
      const id = importedId(`${tracker.id}/former/${key}`)
      players.push({
        id,
        groupId,
        userId: guest === null ? key : null,
        name: guest,
        createdById: guest === null ? null : tracker.creatorId,
        createdAt: tracker.createdAt,
        leftAt,
        leftReason: guest === null ? "left" : "removed",
      })
      if (guest === null) byUser.set(key, id)
      else byGuest.set(guest, id)
    }

    for (const g of imported) {
      games.push(
        planGame(g, data, tracker, (p) =>
          p.userId ? byUser.get(p.userId)! : byGuest.get(p.displayName)!
        )
      )
    }
    const own = players.filter((p) => p.groupId === groupId)
    report.push({
      name: tracker.displayName,
      players: own.filter((p) => !p.leftAt && p.userId).length,
      guests: own.filter((p) => !p.leftAt && !p.userId).length,
      formerPlayers: players.length - current,
      finished: imported.filter((g) => g.status === "COMPLETED").length,
      cancelled: imported.filter((g) => g.status === "CANCELLED").length,
      skippedRunning: trackerGames.length - imported.length,
    })
  }
  return { users, usernames, groups, players, games, report }
}

/** One finished or cancelled Game, its Participants and its Events. */
function planGame(
  old: OldGameRow,
  data: OldData,
  tracker: OldTrackerRow,
  playerOf: (p: OldParticipantRow) => string
) {
  const gameId = importedId(old.id)
  const rounds = data.rounds.filter((r) => r.gameId === old.id)
  const converted = convertGame(rounds)
  const newId = (oldId: string) => importedId(oldId)
  const events = converted.events.map((e) => renamed(e, newId))
  const seating = converted.seating.map(newId)
  const finished = old.status === "COMPLETED"
  const recorded = {
    ruleSet: OLD_RULE_SET,
    participants: seating.map((id) => ({ id })),
    events: events.map((event) => ({ event })),
  }
  const oldParticipants = new Map(
    data.participants.filter((p) => p.gameId === old.id).map((p) => [p.id, p])
  )
  return {
    game: {
      id: gameId,
      groupId: importedId(tracker.id),
      ruleSet: OLD_RULE_SET,
      status: finished ? ("finished" as const) : ("cancelled" as const),
      scorekeeperId: tracker.creatorId,
      // Every Event was a change, and so was cancelling.
      version: events.length + (finished ? 0 : 1),
      spectatorToken: newInviteToken(),
      startedAt: old.createdAt,
      finishedAt: old.updatedAt,
    },
    participants: converted.seating.map((oldId, seat) => {
      const oldParticipant = oldParticipants.get(oldId)
      if (!oldParticipant) {
        throw new Error(`Game ${old.id}: unknown Participant ${oldId}`)
      }
      const id = newId(oldId)
      return {
        id,
        gameId,
        playerId: playerOf(oldParticipant),
        seat,
        ...(finished ? summarize(recorded, id) : {}),
      }
    }),
    events: events.map((event, index) => ({
      gameId,
      version: index + 1,
      event,
      recordedById: tracker.creatorId,
      // The old app kept no time per action: the Game's last change.
      recordedAt: old.updatedAt,
    })),
  }
}

function renamed(event: GameEvent, newId: (id: string) => string): GameEvent {
  switch (event.type) {
    case "lost":
      return {
        ...event,
        loser: newId(event.loser),
        ...(event.tiebreak && { tiebreak: event.tiebreak.map(newId) }),
      }
    case "bomb":
      return {
        ...event,
        thrower: newId(event.thrower),
        ...(event.swimmer && { swimmer: newId(event.swimmer) }),
      }
    case "extraRound":
      return event
  }
}

const VALID_USERNAME = /^[a-zA-Z0-9_.]+$/

/**
 * A username as the new rules allow it (3 to 30 of letters, digits, `_` and
 * `.`): without spaces around it, other characters become `_`, short ones
 * are filled up with `_`.
 */
function fittingUsername(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9_.]/g, "_")
    .padEnd(3, "_")
    .slice(0, 30)
}

/**
 * The accounts with usernames the new app accepts. Accounts without one
 * (Google, in the old app) get one from their e-mail like a new Google
 * sign-up; the rest keep theirs where they fit.
 */
function planUsers(rows: Array<OldUserRow>) {
  const taken = new Set<string>()
  const usernames: ImportReport["usernames"] = []
  const unique = (display: string) => {
    for (let suffix = 1; ; suffix++) {
      const candidate = suffix === 1 ? display : `${display}${suffix}`
      if (!taken.has(candidate.toLowerCase())) {
        taken.add(candidate.toLowerCase())
        return candidate
      }
    }
  }
  // Those whose username fits keep it without a number appended.
  for (const row of rows) {
    const display = row.displayUsername ?? row.username
    if (display && VALID_USERNAME.test(display) && display.length >= 3) {
      taken.add(display.toLowerCase())
    }
  }
  const users: Array<PlannedUser> = rows.map((row) => {
    const before = row.displayUsername ?? row.username
    let display: string
    if (before && VALID_USERNAME.test(before) && before.length >= 3) {
      display = before
    } else {
      display = unique(
        before ? fittingUsername(before) : usernameFromEmail(row.email)
      )
      usernames.push({ name: row.name, from: before, to: display })
    }
    const isBlob = row.image ? isVercelBlob(row.image) : false
    return {
      row: {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.emailVerified,
        username: display.toLowerCase(),
        displayUsername: display,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      keptImage: isBlob ? null : row.image,
      blobImage: isBlob ? row.image : null,
    }
  })
  return { users, usernames }
}

function isVercelBlob(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com")
  } catch {
    return false
  }
}

/** The pictures from Vercel Blob, prepared like an upload in the new app. */
async function loadAvatars(
  users: Array<PlannedUser>,
  fetchImage: ImportOptions["fetchImage"]
) {
  const rows: Array<typeof avatar.$inferInsert> = []
  const images = new Map<string, string>()
  const failed: Array<string> = []
  const now = new Date()
  for (const u of users) {
    if (!u.blobImage) continue
    const bytes = await fetchImage(u.blobImage).catch(() => null)
    const prepared = bytes ? await prepareAvatar(bytes).catch(() => null) : null
    if (!prepared) {
      failed.push(u.row.name)
      continue
    }
    rows.push({ userId: u.row.id, ...prepared, updatedAt: now })
    images.set(u.row.id, avatarUrl(u.row.id, now))
  }
  return { rows, images, failed }
}
