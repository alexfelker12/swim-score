import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { hashPassword } from "better-auth/crypto"
import type { OldDatabase } from "../import-old-data"
import type { OldRound } from "../convert-game"

/** Rows of the old app's tables, as far as the import reads them. */
export type OldUser = {
  id: string
  name: string
  email: string
  emailVerified?: boolean
  image?: string | null
  username?: string | null
  displayUsername?: string | null
  /** A password account with this password. */
  password?: string
  /** A Google account with this `sub`. */
  googleSub?: string
}

export type OldGame = {
  id: string
  status: "ACTIVE" | "COMPLETED" | "CANCELLED"
  createdAt?: Date
  updatedAt?: Date
  /** In the old order; `userId` null for a Guest. */
  participants: Array<{
    id: string
    userId: string | null
    displayName: string
  }>
  rounds: Array<OldRound>
}

export type OldTracker = {
  id: string
  displayName: string
  type?: "SCHWIMMEN" | "DURAK"
  creatorId: string
  createdAt?: Date
  /** Accounts by id, Guests by name. */
  players: Array<{ id: string; userId: string } | { id: string; guest: string }>
  games: Array<OldGame>
}

/**
 * The old app's database (score-tracker, Prisma) in PGlite, with its real
 * schema (`fixtures/old-schema.sql`) and the given rows.
 */
export async function createOldDatabase({
  users,
  trackers,
}: {
  users: Array<OldUser>
  trackers: Array<OldTracker>
}): Promise<OldDatabase> {
  const db = new PGlite()
  await db.exec(
    readFileSync(new URL("../fixtures/old-schema.sql", import.meta.url), "utf8")
  )
  const at = new Date("2025-06-01T18:00:00Z")
  for (const u of users) {
    await db.query(
      `insert into "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt", username, "displayUsername")
       values ($1, $2, $3, $4, $5, $6, $6, $7, $8)`,
      [
        u.id,
        u.name,
        u.email,
        u.emailVerified ?? true,
        u.image ?? null,
        at,
        u.username ?? null,
        u.displayUsername ?? null,
      ]
    )
    if (u.password) {
      await db.query(
        `insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         values ($1, $2, 'credential', $2, $3, $4, $4)`,
        [`${u.id}-credential`, u.id, await hashPassword(u.password), at]
      )
    }
    if (u.googleSub) {
      await db.query(
        `insert into account (id, "accountId", "providerId", "userId", "accessToken", "idToken", scope, "createdAt", "updatedAt")
         values ($1, $2, 'google', $3, 'old-access-token', 'old-id-token', 'openid email profile', $4, $4)`,
        [`${u.id}-google`, u.googleSub, u.id, at]
      )
    }
  }
  for (const t of trackers) {
    const created = t.createdAt ?? at
    await db.query(
      `insert into "Tracker" (id, type, "displayName", "updatedAt", "createdAt", "creatorId")
       values ($1, $2, $3, $4, $4, $5)`,
      [t.id, t.type ?? "SCHWIMMEN", t.displayName, created, t.creatorId]
    )
    for (const p of t.players) {
      await db.query(
        `insert into "TrackerPlayer" (id, "displayName", "trackerId", "playerId") values ($1, $2, $3, $4)`,
        "userId" in p
          ? [
              p.id,
              users.find((u) => u.id === p.userId)?.name ?? "",
              t.id,
              p.userId,
            ]
          : [p.id, p.guest, t.id, null]
      )
    }
    for (const g of t.games) {
      const createdAt = g.createdAt ?? created
      await db.query(
        `insert into "Game" (id, "createdAt", "updatedAt", status, "trackerId", "gameData") values ($1, $2, $3, $4, $5, '{}')`,
        [g.id, createdAt, g.updatedAt ?? createdAt, g.status, t.id]
      )
      for (const p of g.participants) {
        await db.query(
          `insert into "GameParticipant" (id, "displayName", "gameId", "userId") values ($1, $2, $3, $4)`,
          [p.id, p.displayName, g.id, p.userId]
        )
      }
      for (const r of g.rounds) {
        await db.query(
          `insert into "GameRound" (data, round, "gameId") values ($1, $2, $3)`,
          [JSON.stringify({ type: "SCHWIMMEN", ...r.data }), r.round, g.id]
        )
      }
    }
  }
  return {
    query: async <T>(text: string, params?: Array<unknown>) =>
      (await db.query<T>(text, params)).rows,
  }
}
