import { and, eq, inArray, isNotNull, max, ne } from "drizzle-orm"
import { THEMES, avatar, game, group, player, user } from "./db/schema"
import { CommandError } from "./errors"
import { lockGroup, makeFormer } from "./groups"
import { requireUser } from "./session"
import type { App } from "./app"
import type { AvatarCrop, Theme } from "./db/schema"

export type { AvatarCrop, Theme }

export type Profile = {
  id: string
  /** Display name. */
  name: string
  /** The username as typed; it is matched case-insensitively at sign-in. */
  username: string
  email: string
  image: string | null
  theme: Theme
}

const MAX_NAME_LENGTH = 30
const MAX_AVATAR_BYTES = 256 * 1024
const MAX_SOURCE_BYTES = 1024 * 1024

export async function getProfile(app: App, headers: Headers): Promise<Profile> {
  const { id } = await requireUser(app, headers)
  const row = await app.db.query.user.findFirst({ where: eq(user.id, id) })
  if (!row) throw new CommandError("notSignedIn")
  return {
    id: row.id,
    name: row.name,
    username: row.displayUsername ?? row.username ?? "",
    email: row.email,
    image: row.image,
    theme: row.theme,
  }
}

/** Changes the display name and, if given, the e-mail address. */
export async function updateProfile(
  app: App,
  headers: Headers,
  input: { name: string; email?: string }
): Promise<void> {
  const { id } = await requireUser(app, headers)
  const name = input.name.trim()
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    throw new CommandError("invalidName")
  }
  const before = await app.db.query.user.findFirst({
    where: eq(user.id, id),
    columns: { email: true },
  })
  const email = input.email?.trim().toLowerCase()
  const emailChanged = email !== undefined && email !== before?.email
  if (emailChanged) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new CommandError("invalidEmail")
    }
    const taken = await app.db.query.user.findFirst({
      where: and(eq(user.email, email), ne(user.id, id)),
      columns: { id: true },
    })
    if (taken) throw new CommandError("emailTaken")
  }
  try {
    await app.db
      .update(user)
      // A new address is unconfirmed: better-auth then refuses to link a
      // Google account with that address to this account.
      .set(emailChanged ? { name, email, emailVerified: false } : { name })
      .where(eq(user.id, id))
  } catch (error) {
    if (isUniqueViolation(error)) throw new CommandError("emailTaken")
    throw error
  }
}

function isUniqueViolation(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505"
  )
}

export async function setTheme(
  app: App,
  headers: Headers,
  input: { theme: Theme }
): Promise<void> {
  const { id } = await requireUser(app, headers)
  if (!THEMES.includes(input.theme)) {
    throw new CommandError("invalidTheme")
  }
  await app.db.update(user).set({ theme: input.theme }).where(eq(user.id, id))
}

/**
 * Stores a profile picture the browser has already cropped and resized,
 * together with the downscaled source image and the crop, replacing any
 * earlier picture.
 */
export async function setAvatar(
  app: App,
  headers: Headers,
  input: { avatar: Uint8Array; source: Uint8Array; crop: AvatarCrop }
): Promise<void> {
  const { id } = await requireUser(app, headers)
  const contentType = imageType(input.avatar)
  const sourceContentType = imageType(input.source)
  if (
    !contentType ||
    input.avatar.byteLength > MAX_AVATAR_BYTES ||
    !sourceContentType ||
    input.source.byteLength > MAX_SOURCE_BYTES
  ) {
    throw new CommandError("invalidImage")
  }
  if (!isValidCrop(input.crop)) throw new CommandError("invalidCrop")
  const { x, y, size } = input.crop
  const values = {
    contentType,
    data: input.avatar,
    sourceContentType,
    source: input.source,
    crop: { x, y, size },
    updatedAt: new Date(),
  }
  await app.db.transaction(async (tx) => {
    await tx
      .insert(avatar)
      .values({ userId: id, ...values })
      .onConflictDoUpdate({ target: avatar.userId, set: values })
    await tx
      .update(user)
      .set({ image: `/api/avatar/${id}?v=${values.updatedAt.getTime()}` })
      .where(eq(user.id, id))
  })
}

/**
 * What the picture editor starts from: the stored source image and crop, the
 * avatar itself for pictures from before cropping existed, or the Google
 * picture. Null when there is no picture.
 */
export async function getAvatarSource(
  app: App,
  headers: Headers
): Promise<{
  source: { contentType: string; data: Uint8Array } | { url: string }
  crop: AvatarCrop
} | null> {
  const { id } = await requireUser(app, headers)
  const row = await app.db.query.avatar.findFirst({
    where: eq(avatar.userId, id),
  })
  if (row?.source && row.sourceContentType && row.crop) {
    return {
      source: { contentType: row.sourceContentType, data: row.source },
      crop: row.crop,
    }
  }
  if (row) {
    return {
      source: { contentType: row.contentType, data: row.data },
      crop: FULL_CROP,
    }
  }
  const account = await app.db.query.user.findFirst({
    where: eq(user.id, id),
    columns: { image: true },
  })
  return account?.image
    ? { source: { url: account.image }, crop: FULL_CROP }
    : null
}

/** Deletes the picture with its source; the profile shows the initial again. */
export async function removeAvatar(app: App, headers: Headers): Promise<void> {
  const { id } = await requireUser(app, headers)
  await app.db.transaction(async (tx) => {
    await tx.delete(avatar).where(eq(avatar.userId, id))
    await tx.update(user).set({ image: null }).where(eq(user.id, id))
  })
}

const FULL_CROP: AvatarCrop = { x: 0, y: 0, size: 1 }

/** Whether the crop is a well-formed crop; data from the browser is not trusted. */
function isValidCrop(crop: unknown): crop is AvatarCrop {
  if (typeof crop !== "object" || crop === null) return false
  const { x, y, size } = crop as Record<string, unknown>
  return (
    typeof x === "number" &&
    typeof y === "number" &&
    typeof size === "number" &&
    [x, y, size].every(Number.isFinite) &&
    x >= 0 &&
    x < 1 &&
    y >= 0 &&
    y < 1 &&
    size > 0 &&
    size <= 1
  )
}

/** The image type by its first bytes; the type the browser claims is not trusted. */
function imageType(data: Uint8Array): string | null {
  const starts = (...bytes: Array<number>) =>
    bytes.every((byte, i) => data[i] === byte)
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png"
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg"
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...data.subarray(from, to))
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp"
  return null
}

/** A player's uploaded profile picture; only for signed-in accounts. */
export async function getAvatar(
  app: App,
  headers: Headers,
  userId: string
): Promise<{ contentType: string; data: Uint8Array } | null> {
  await requireUser(app, headers)
  const row = await app.db.query.avatar.findFirst({
    where: eq(avatar.userId, userId),
  })
  return row ? { contentType: row.contentType, data: row.data } : null
}

/**
 * Deletes the account: name, picture, e-mail and sign-in are gone. In every
 * Group it stays as an anonymous Former Player ("Ehemaliger Spieler N"), so
 * past Games and everyone else's results are unchanged.
 *
 * Refused while the account is Group Admin of a Group with other current
 * Players with an account: it hands over the role first. A Group it manages
 * in which no other account ever played goes with it, since nobody could
 * see it any more. One where only Former Players have accounts stays,
 * without a Group Admin, for their past Games.
 */
export async function deleteAccount(app: App, headers: Headers): Promise<void> {
  const { id } = await requireUser(app, headers)
  await app.db.transaction(async (tx) => {
    // Every Group the account plays or played in is locked first, so joins,
    // hand-overs and other deletions there wait until this one is done.
    const mine = await tx.query.player.findMany({
      where: eq(player.userId, id),
      columns: { id: true, groupId: true, leftAt: true },
    })
    const rows = await Promise.all(
      mine.map((own) => lockGroup(tx, own.groupId))
    )
    const administered = mine
      .filter((_, i) => rows[i]?.adminId === id)
      .map((own) => own.groupId)
    const others = await tx.query.player.findMany({
      where: and(
        inArray(player.groupId, administered),
        isNotNull(player.userId),
        ne(player.userId, id)
      ),
      columns: { groupId: true, leftAt: true },
    })
    if (others.some((p) => p.leftAt === null)) {
      throw new CommandError("stillAdmin")
    }
    const alone = administered.filter(
      (groupId) => !others.some((p) => p.groupId === groupId)
    )
    if (alone.length > 0) {
      // Games first: their Participants still point at the Players.
      await tx.delete(game).where(inArray(game.groupId, alone))
      await tx.delete(group).where(inArray(group.id, alone))
    }
    for (const own of mine.filter((p) => !alone.includes(p.groupId))) {
      const [numbered] = await tx
        .select({ last: max(player.formerNumber) })
        .from(player)
        .where(eq(player.groupId, own.groupId))
      await makeFormer(tx, own.id, "deleted", {
        userId: null,
        name: null,
        formerNumber: (numbered.last ?? 0) + 1,
        // Someone who had already left keeps the date they left.
        ...(own.leftAt ? { leftAt: own.leftAt } : {}),
      })
    }
    // Sessions, sign-in methods and the picture go with the account; the
    // Group Admin role of a Group that stays becomes empty.
    await tx.delete(user).where(eq(user.id, id))
  })
}
