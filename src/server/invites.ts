import { and, count, eq, inArray } from "drizzle-orm"
import {
  claim,
  game,
  group,
  newInviteToken,
  participant,
  player,
} from "./db/schema"
import { CommandError } from "./errors"
import { requireUser } from "./session"
import type { App } from "./app"

/** What a person holding an Invite sees of the Group before joining. */
export type InviteView = {
  groupId: string
  groupName: string
  /** Display Name of the Group Admin. */
  invitedBy: string
  playerCount: number
  /** Finished Games of the Group. */
  gameCount: number
  /** The signed-in account already plays in this Group. */
  alreadyPlayer: boolean
  /** The Guests the person could be, sorted by name. */
  guests: Array<{ id: string; name: string; games: number }>
}

/** What only the Group Admin sees: open Claims and who could be linked. */
export type GroupManagement = {
  /** Per Player: finished Games, and the Username of those with an account. */
  players: Array<{ id: string; username: string | null; games: number }>
  /** Oldest first. `playerId` says they are `guestId`. */
  claims: Array<{ id: string; playerId: string; guestId: string }>
}

const byName = new Intl.Collator("de", { sensitivity: "accent" })

/** The Group's current Invite token, for its link and QR code; Group Admin only. */
export async function getInviteLink(
  app: App,
  headers: Headers,
  input: { groupId: string }
): Promise<{ token: string }> {
  const me = await requireUser(app, headers)
  const row = await requireAdmin(app, input.groupId, me.id)
  return { token: row.inviteToken }
}

/** Replaces the Invite token: the old link and QR code stop working at once. */
export async function renewInvite(
  app: App,
  headers: Headers,
  input: { groupId: string }
): Promise<{ token: string }> {
  const me = await requireUser(app, headers)
  await requireAdmin(app, input.groupId, me.id)
  const token = newInviteToken()
  await app.db
    .update(group)
    .set({ inviteToken: token })
    .where(eq(group.id, input.groupId))
  return { token }
}

/** The Group behind an Invite; refused when the token is not the current one. */
export async function getInvite(
  app: App,
  headers: Headers,
  input: { token: string }
): Promise<InviteView> {
  const me = await requireUser(app, headers)
  const row = await app.db.query.group.findFirst({
    where: eq(group.inviteToken, input.token),
    with: {
      admin: { columns: { name: true } },
      players: { columns: { id: true, userId: true, name: true } },
    },
  })
  if (!row) throw new CommandError("inviteInvalid")
  const games = await finishedGames(app, row.id)
  return {
    groupId: row.id,
    groupName: row.name,
    invitedBy: row.admin.name,
    playerCount: row.players.length,
    gameCount: await app.db.$count(
      game,
      and(eq(game.groupId, row.id), eq(game.status, "finished"))
    ),
    alreadyPlayer: row.players.some((p) => p.userId === me.id),
    guests: row.players
      .filter((p) => p.userId === null)
      .map((p) => ({
        id: p.id,
        name: p.name ?? "",
        games: games.get(p.id) ?? 0,
      }))
      .sort((a, b) => byName.compare(a.name, b.name)),
  }
}

/**
 * Joins the Group behind an Invite as a new Player. With `guestId` the
 * account also claims that Guest: it is a Player at once, and the Guest's
 * Games become its own once the Group Admin confirms the Claim.
 *
 * An account that already plays in the Group stays the Player it is.
 */
export async function joinGroup(
  app: App,
  headers: Headers,
  input: { token: string; guestId?: string }
): Promise<{ groupId: string }> {
  const me = await requireUser(app, headers)
  const row = await app.db.query.group.findFirst({
    where: eq(group.inviteToken, input.token),
    columns: { id: true },
  })
  if (!row) throw new CommandError("inviteInvalid")
  const groupId = row.id
  await app.db.transaction(async (tx) => {
    if (input.guestId !== undefined) {
      const guest = await tx.query.player.findFirst({
        where: and(eq(player.id, input.guestId), eq(player.groupId, groupId)),
        columns: { userId: true },
      })
      if (!guest || guest.userId !== null) {
        throw new CommandError("guestNotFound")
      }
    }
    const playerId = crypto.randomUUID()
    // The unique index on (group, account) keeps an account to one Player.
    const joined = await tx
      .insert(player)
      .values({ id: playerId, groupId, userId: me.id })
      .onConflictDoNothing()
      .returning({ id: player.id })
    if (joined.length === 0 || input.guestId === undefined) return
    await tx.insert(claim).values({
      id: crypto.randomUUID(),
      groupId,
      playerId,
      guestId: input.guestId,
    })
  })
  return { groupId }
}

/** Open Claims and what linking a Guest needs to show; Group Admin only. */
export async function getGroupManagement(
  app: App,
  headers: Headers,
  input: { groupId: string }
): Promise<GroupManagement> {
  const me = await requireUser(app, headers)
  await requireAdmin(app, input.groupId, me.id)
  const players = await app.db.query.player.findMany({
    where: eq(player.groupId, input.groupId),
    columns: { id: true },
    with: { user: { columns: { username: true, displayUsername: true } } },
  })
  const games = await finishedGames(app, input.groupId)
  const claims = await app.db.query.claim.findMany({
    where: eq(claim.groupId, input.groupId),
    orderBy: claim.createdAt,
    columns: { id: true, playerId: true, guestId: true },
  })
  return {
    players: players.map((p) => ({
      id: p.id,
      username: p.user ? (p.user.displayUsername ?? p.user.username) : null,
      games: games.get(p.id) ?? 0,
    })),
    claims,
  }
}

/** The Group Admin confirms a Claim: the Guest's Games now belong to the account. */
export async function confirmClaim(
  app: App,
  headers: Headers,
  input: { claimId: string }
): Promise<void> {
  const me = await requireUser(app, headers)
  const found = await requireClaim(app, input.claimId, me.id)
  await mergeGuest(app, found.groupId, found.guestId, found.playerId, found.id)
}

/** The Group Admin rejects a Claim: the account stays a Player, the Guest a Guest. */
export async function rejectClaim(
  app: App,
  headers: Headers,
  input: { claimId: string }
): Promise<void> {
  const me = await requireUser(app, headers)
  await requireClaim(app, input.claimId, me.id)
  await app.db.delete(claim).where(eq(claim.id, input.claimId))
}

/** The Group Admin links a Guest to another Player with an account, without a Claim. */
export async function linkGuest(
  app: App,
  headers: Headers,
  input: { groupId: string; guestId: string; playerId: string }
): Promise<void> {
  const me = await requireUser(app, headers)
  await requireAdmin(app, input.groupId, me.id)
  await mergeGuest(app, input.groupId, input.guestId, input.playerId)
}

/**
 * Merges a Guest into a Player with an account of the same Group, other than
 * the Group Admin: the Guest's Games become the Player's and the Guest is
 * gone. Refused when both sat in the same Game, since then they are two people.
 *
 * With `claimId` the merge confirms that Claim and is refused when the Claim
 * has been decided in the meantime.
 */
async function mergeGuest(
  app: App,
  groupId: string,
  guestId: string,
  playerId: string,
  claimId?: string
) {
  await app.db.transaction(async (tx) => {
    // Locking the rows makes concurrent merges and decisions take turns.
    const both = await tx
      .select({ id: player.id, userId: player.userId })
      .from(player)
      .where(
        and(
          eq(player.groupId, groupId),
          inArray(player.id, [guestId, playerId])
        )
      )
      .for("update")
    if (claimId !== undefined) {
      const open = await tx
        .select({ id: claim.id })
        .from(claim)
        .where(eq(claim.id, claimId))
        .for("update")
      if (open.length === 0) throw new CommandError("claimNotFound")
    }
    const guest = both.find((p) => p.id === guestId)
    const target = both.find((p) => p.id === playerId)
    if (!guest || guest.userId !== null) throw new CommandError("guestNotFound")
    // Only the Group Admin merges, and does not link a Guest to themselves.
    const admin = await tx.query.group.findFirst({
      where: eq(group.id, groupId),
      columns: { adminId: true },
    })
    if (!target || target.userId === null || target.userId === admin?.adminId) {
      throw new CommandError("playerNotFound")
    }
    const seats = await tx.query.participant.findMany({
      where: inArray(participant.playerId, [guestId, playerId]),
      columns: { gameId: true },
    })
    if (new Set(seats.map((s) => s.gameId)).size < seats.length) {
      throw new CommandError("playedTogether")
    }
    await tx
      .update(participant)
      .set({ playerId })
      .where(eq(participant.playerId, guestId))
    // The account is linked now: whatever else it claimed is void. Claims on
    // the Guest go away with the Guest.
    await tx.delete(claim).where(eq(claim.playerId, playerId))
    await tx.delete(player).where(eq(player.id, guestId))
  })
}

/** Finished Games per Player of the Group; Players without one are missing. */
async function finishedGames(
  app: App,
  groupId: string
): Promise<Map<string, number>> {
  const rows = await app.db
    .select({ playerId: participant.playerId, games: count() })
    .from(participant)
    .innerJoin(game, eq(game.id, participant.gameId))
    .where(and(eq(game.groupId, groupId), eq(game.status, "finished")))
    .groupBy(participant.playerId)
  return new Map(rows.map((row) => [row.playerId, row.games]))
}

/**
 * The Group, for its Group Admin only. Other Players are told they are not
 * the Group Admin; to anyone else the Group does not exist.
 */
async function requireAdmin(app: App, groupId: string, userId: string) {
  const row = await app.db.query.group.findFirst({
    where: eq(group.id, groupId),
    columns: { adminId: true, inviteToken: true },
    with: {
      players: { where: eq(player.userId, userId), columns: { id: true } },
    },
  })
  if (!row || row.players.length === 0) throw new CommandError("groupNotFound")
  if (row.adminId !== userId) throw new CommandError("notAdmin")
  return row
}

/** A Claim, for the Group Admin of its Group only. */
async function requireClaim(app: App, claimId: string, userId: string) {
  const found = await app.db.query.claim.findFirst({
    where: eq(claim.id, claimId),
  })
  if (!found) throw new CommandError("claimNotFound")
  try {
    await requireAdmin(app, found.groupId, userId)
  } catch (error) {
    // Outsiders learn nothing about a Claim, not even its Group.
    if (error instanceof CommandError && error.code === "groupNotFound") {
      throw new CommandError("claimNotFound")
    }
    throw error
  }
  return found
}
