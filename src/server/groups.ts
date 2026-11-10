import {
  aliasedTable,
  and,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  or,
} from "drizzle-orm"
import { claim, group, player } from "./db/schema"
import { CommandError } from "./errors"
import { requireUser } from "./session"
import type { App } from "./app"
import type { LeaveReason } from "./db/schema"

/** A database transaction, for helpers that must run inside one. */
export type Tx = Parameters<Parameters<App["db"]["transaction"]>[0]>[0]

/** The database or a transaction on it. */
export type Db = App["db"] | Tx

/** A Player as every Player of the Group sees them; never an e-mail address. */
export type GroupPlayer = {
  id: string
  /** Display Name for accounts, the given name for Guests. */
  name: string
  image: string | null
  guest: boolean
  admin: boolean
  /** The signed-in account's own Player. */
  me: boolean
  /** For a Guest: the Display Name of the account that added them. */
  addedBy: string | null
  joinedAt: Date
}

/** A Player no longer in the Group; still shown in past Games. */
export type FormerPlayer = {
  id: string
  /** "Ehemaliger Spieler N" for a deleted account. */
  name: string
  reason: LeaveReason
  leftAt: Date
}

export type GroupView = {
  id: string
  name: string
  isAdmin: boolean
  /** The current Players, sorted by name. */
  players: Array<GroupPlayer>
  /** Sorted by name. */
  formerPlayers: Array<FormerPlayer>
}

const MAX_GROUP_NAME_LENGTH = 40
const MAX_GUEST_NAME_LENGTH = 30

// Case does not matter, accents do: "emil" is Emil, "Zoë" is not "Zoe".
// Numbers count as numbers: "Ehemaliger Spieler 2" before "… 10".
const byName = new Intl.Collator("de", { sensitivity: "accent", numeric: true })

/** Players still in their Group; Former Players have left it. */
export const isCurrentPlayer = isNull(player.leftAt)

/** Creates a Group; the creator becomes its first Player and its Group Admin. */
export async function createGroup(
  app: App,
  headers: Headers,
  input: { name: string }
): Promise<{ id: string }> {
  const me = await requireUser(app, headers)
  const name = groupName(input.name)
  const id = crypto.randomUUID()
  await app.db.transaction(async (tx) => {
    await tx.insert(group).values({ id, name, adminId: me.id })
    await tx.insert(player).values({
      id: crypto.randomUUID(),
      groupId: id,
      userId: me.id,
    })
  })
  return { id }
}

/** A Group with its Players; only its own Players may see it. */
export async function getGroup(
  app: App,
  headers: Headers,
  input: { groupId: string }
): Promise<GroupView> {
  const me = await requireUser(app, headers)
  const row = await app.db.query.group.findFirst({
    where: eq(group.id, input.groupId),
    with: {
      players: {
        with: {
          // Only what other Players may see; never the e-mail address.
          user: { columns: { name: true, image: true } },
          createdBy: { columns: { name: true } },
        },
      },
    },
  })
  const active = row?.players.filter((p) => p.leftAt === null) ?? []
  if (!row || !active.some((p) => p.userId === me.id)) {
    throw new CommandError("groupNotFound")
  }
  return {
    id: row.id,
    name: row.name,
    isAdmin: row.adminId === me.id,
    players: active
      .map((p) => ({
        id: p.id,
        name: playerName(p),
        image: p.user?.image ?? null,
        guest: isGuest(p),
        admin: p.userId !== null && p.userId === row.adminId,
        me: p.userId === me.id,
        addedBy: isGuest(p) ? (p.createdBy?.name ?? null) : null,
        joinedAt: p.createdAt,
      }))
      .sort((a, b) => byName.compare(a.name, b.name)),
    formerPlayers: row.players
      .flatMap((p) =>
        p.leftAt && p.leftReason
          ? [
              {
                id: p.id,
                name: playerName(p),
                reason: p.leftReason,
                leftAt: p.leftAt,
              },
            ]
          : []
      )
      .sort((a, b) => byName.compare(a.name, b.name)),
  }
}

/** Adds a Guest to the Group; any Player with an account may do this. */
export async function addGuest(
  app: App,
  headers: Headers,
  input: { groupId: string; name: string }
): Promise<{ id: string }> {
  const me = await requireUser(app, headers)
  await requirePlayer(app, input.groupId, me.id)
  const name = input.name.trim()
  if (name.length === 0 || name.length > MAX_GUEST_NAME_LENGTH) {
    throw new CommandError("invalidName")
  }
  const players = await app.db.query.player.findMany({
    where: and(eq(player.groupId, input.groupId), isCurrentPlayer),
    columns: { name: true, formerNumber: true },
    with: { user: { columns: { name: true } } },
  })
  // Two Players with the same name could not be told apart at the table.
  const taken = players.some((p) => byName.compare(playerName(p), name) === 0)
  if (taken) throw new CommandError("nameTaken")
  const id = crypto.randomUUID()
  await app.db
    .insert(player)
    .values({ id, groupId: input.groupId, name, createdById: me.id })
  return { id }
}

export type MyGroup = { id: string; name: string; playerCount: number }

/** The Groups the signed-in account plays in, most recently joined first. */
export async function listMyGroups(
  app: App,
  headers: Headers
): Promise<Array<MyGroup>> {
  const me = await requireUser(app, headers)
  const mine = aliasedTable(player, "mine")
  return app.db
    .select({ id: group.id, name: group.name, playerCount: count(player.id) })
    .from(mine)
    .innerJoin(group, eq(group.id, mine.groupId))
    .innerJoin(player, and(eq(player.groupId, group.id), isCurrentPlayer))
    .where(and(eq(mine.userId, me.id), isNull(mine.leftAt)))
    .groupBy(group.id, mine.createdAt)
    .orderBy(desc(mine.createdAt))
}

/**
 * Refuses anyone who is not a Player of the Group as if it (or the Game
 * asked for, with `code` "gameNotFound") did not exist.
 */
export async function requirePlayer(
  app: App,
  groupId: string,
  userId: string,
  code = "groupNotFound"
) {
  const row = await app.db.query.player.findFirst({
    where: and(
      eq(player.groupId, groupId),
      eq(player.userId, userId),
      isCurrentPlayer
    ),
    columns: { id: true },
  })
  if (!row) throw new CommandError(code)
  return row
}

/**
 * The Group, for its Group Admin only. Other Players are told they are not
 * the Group Admin; to anyone else the Group does not exist.
 */
export async function requireAdmin(
  db: Db,
  groupId: string,
  userId: string,
  { lock = false } = {}
) {
  // Inside a transaction that changes the Group, its row is locked first so
  // that removing, leaving and handing over take turns.
  if (lock) await lockGroup(db, groupId)
  const row = await db.query.group.findFirst({
    where: eq(group.id, groupId),
    columns: { adminId: true, inviteToken: true },
    with: {
      players: {
        where: and(eq(player.userId, userId), isCurrentPlayer),
        columns: { id: true },
      },
    },
  })
  if (!row || row.players.length === 0) throw new CommandError("groupNotFound")
  if (row.adminId !== userId) throw new CommandError("notAdmin")
  return row
}

/** Renames the Group; Group Admin only. */
export async function renameGroup(
  app: App,
  headers: Headers,
  input: { groupId: string; name: string }
): Promise<void> {
  const me = await requireUser(app, headers)
  await requireAdmin(app.db, input.groupId, me.id)
  const name = groupName(input.name)
  await app.db.update(group).set({ name }).where(eq(group.id, input.groupId))
}

/**
 * The Group Admin removes a Player, who becomes a Former Player: still in
 * past Games, no longer in the Group. The Group Admin cannot remove
 * themselves; they hand over the role and leave.
 */
export async function removePlayer(
  app: App,
  headers: Headers,
  input: { groupId: string; playerId: string }
): Promise<void> {
  const me = await requireUser(app, headers)
  await app.db.transaction(async (tx) => {
    await requireAdmin(tx, input.groupId, me.id, { lock: true })
    const target = await tx.query.player.findFirst({
      where: and(
        eq(player.id, input.playerId),
        eq(player.groupId, input.groupId),
        isCurrentPlayer
      ),
      columns: { id: true, userId: true },
    })
    if (!target) throw new CommandError("playerNotFound")
    if (target.userId === me.id) throw new CommandError("adminCannotLeave")
    await makeFormer(tx, target.id, "removed")
  })
}

/** The signed-in account leaves the Group and becomes a Former Player in it. */
export async function leaveGroup(
  app: App,
  headers: Headers,
  input: { groupId: string }
): Promise<void> {
  const me = await requireUser(app, headers)
  await app.db.transaction(async (tx) => {
    const row = await lockGroup(tx, input.groupId)
    const mine = await tx.query.player.findFirst({
      where: and(
        eq(player.groupId, input.groupId),
        eq(player.userId, me.id),
        isCurrentPlayer
      ),
      columns: { id: true },
    })
    if (!row || !mine) throw new CommandError("groupNotFound")
    if (row.adminId === me.id) throw new CommandError("adminCannotLeave")
    await makeFormer(tx, mine.id, "left")
  })
}

/** The Group Admin passes the role to another current Player with an account. */
export async function handOverAdmin(
  app: App,
  headers: Headers,
  input: { groupId: string; playerId: string }
): Promise<void> {
  const me = await requireUser(app, headers)
  await app.db.transaction(async (tx) => {
    await requireAdmin(tx, input.groupId, me.id, { lock: true })
    const target = await tx.query.player.findFirst({
      where: and(
        eq(player.id, input.playerId),
        eq(player.groupId, input.groupId),
        isNotNull(player.userId),
        isCurrentPlayer
      ),
      columns: { userId: true },
    })
    if (!target?.userId || target.userId === me.id) {
      throw new CommandError("playerNotFound")
    }
    await tx
      .update(group)
      .set({ adminId: target.userId })
      .where(eq(group.id, input.groupId))
  })
}

/** Locks the Group's row until the transaction ends; undefined if there is none. */
export async function lockGroup(db: Db, groupId: string) {
  const [row] = await db
    .select({ adminId: group.adminId })
    .from(group)
    .where(eq(group.id, groupId))
    .for("update")
  return row as { adminId: string | null } | undefined
}

/**
 * Turns a Player into a Former Player. Their Participants stay, so past
 * Games are unchanged; open Claims by or for them go.
 */
export async function makeFormer(
  tx: Tx,
  playerId: string,
  reason: LeaveReason,
  extra: Partial<typeof player.$inferInsert> = {}
) {
  await tx
    .update(player)
    .set({ leftAt: new Date(), leftReason: reason, ...extra })
    .where(eq(player.id, playerId))
  await tx
    .delete(claim)
    .where(or(eq(claim.playerId, playerId), eq(claim.guestId, playerId)))
}

/**
 * Display Name for a Player with an account, the given name for a Guest, and
 * "Ehemaliger Spieler N" for a deleted account, which has neither.
 */
export function playerName(p: {
  name: string | null
  formerNumber: number | null
  user: { name: string } | null
}): string {
  if (p.user) return p.user.name
  if (p.formerNumber !== null) return `Ehemaliger Spieler ${p.formerNumber}`
  return p.name ?? ""
}

/** A Player without an account who never had one; deleted accounts are not Guests. */
export function isGuest(p: {
  userId: string | null
  formerNumber: number | null
}) {
  return p.userId === null && p.formerNumber === null
}

function groupName(raw: string): string {
  const name = raw.trim()
  if (name.length === 0 || name.length > MAX_GROUP_NAME_LENGTH) {
    throw new CommandError("invalidName")
  }
  return name
}
