import { aliasedTable, and, count, desc, eq } from "drizzle-orm"
import { group, player } from "./db/schema"
import { CommandError } from "./errors"
import { requireUser } from "./session"
import type { App } from "./app"

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
}

export type GroupView = {
  id: string
  name: string
  isAdmin: boolean
  players: Array<GroupPlayer>
}

const MAX_GROUP_NAME_LENGTH = 40
const MAX_GUEST_NAME_LENGTH = 30

// Case does not matter, accents do: "emil" is Emil, "Zoë" is not "Zoe".
const byName = new Intl.Collator("de", { sensitivity: "accent" })

/** Creates a Group; the creator becomes its first Player and its Group Admin. */
export async function createGroup(
  app: App,
  headers: Headers,
  input: { name: string }
): Promise<{ id: string }> {
  const me = await requireUser(app, headers)
  const name = input.name.trim()
  if (name.length === 0 || name.length > MAX_GROUP_NAME_LENGTH) {
    throw new CommandError("invalidName")
  }
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
  if (!row || !row.players.some((p) => p.userId === me.id)) {
    throw new CommandError("groupNotFound")
  }
  return {
    id: row.id,
    name: row.name,
    isAdmin: row.adminId === me.id,
    players: row.players
      .map((p) => ({
        id: p.id,
        name: playerName(p),
        image: p.user?.image ?? null,
        guest: p.userId === null,
        admin: p.userId !== null && p.userId === row.adminId,
        me: p.userId === me.id,
        addedBy: p.userId === null ? (p.createdBy?.name ?? null) : null,
      }))
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
    where: eq(player.groupId, input.groupId),
    columns: { name: true },
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
    .innerJoin(player, eq(player.groupId, group.id))
    .where(eq(mine.userId, me.id))
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
    where: and(eq(player.groupId, groupId), eq(player.userId, userId)),
    columns: { id: true },
  })
  if (!row) throw new CommandError(code)
}

/** Display Name for a Player with an account, the given name for a Guest. */
export function playerName(p: {
  name: string | null
  user: { name: string } | null
}): string {
  return p.user?.name ?? p.name ?? ""
}
