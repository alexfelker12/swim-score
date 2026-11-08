import { and, eq, ne } from "drizzle-orm"
import { THEMES, avatar, user } from "./db/schema"
import { CommandError } from "./errors"
import { requireUser } from "./session"
import type { App } from "./app"
import type { Theme } from "./db/schema"

export type { Theme }

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
  const current = await app.db.query.user.findFirst({
    where: eq(user.id, id),
    columns: { email: true },
  })
  const email = input.email?.trim().toLowerCase()
  const emailChanged = email !== undefined && email !== current?.email
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

/** Stores a profile picture the browser has already resized. */
export async function setAvatar(
  app: App,
  headers: Headers,
  input: { data: Uint8Array }
): Promise<void> {
  const { id } = await requireUser(app, headers)
  const contentType = imageType(input.data)
  if (!contentType || input.data.byteLength > MAX_AVATAR_BYTES) {
    throw new CommandError("invalidImage")
  }
  const updatedAt = new Date()
  await app.db.transaction(async (tx) => {
    await tx
      .insert(avatar)
      .values({
        userId: id,
        contentType,
        data: input.data,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: avatar.userId,
        set: { contentType, data: input.data, updatedAt },
      })
    await tx
      .update(user)
      .set({ image: `/api/avatar/${id}?v=${updatedAt.getTime()}` })
      .where(eq(user.id, id))
  })
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
