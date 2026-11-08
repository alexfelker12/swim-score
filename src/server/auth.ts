import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { username } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { eq } from "drizzle-orm"
import * as schema from "./db/schema"
import type { GoogleOptions } from "better-auth/social-providers"
import type { Database } from "./db"

export type AuthConfig = {
  db: Database
  baseURL: string
  secret: string
  /** Sign-in with Google; left out where no credentials are configured. */
  google?: GoogleOptions
}

export function createAuth({ db, baseURL, secret, google }: AuthConfig) {
  return betterAuth({
    baseURL,
    secret,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    socialProviders: google ? { google } : {},
    user: {
      additionalFields: {
        theme: {
          type: [...schema.THEMES],
          required: false,
          defaultValue: "dark",
          input: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          async before(newUser) {
            const record = newUser as typeof newUser & {
              username?: string | null
              displayUsername?: string | null
            }
            if (record.username) {
              // The display name starts out as the username as typed.
              const name =
                record.name.trim() || record.displayUsername || record.username
              return { data: { ...newUser, name } }
            }
            const derived = await freeUsername(db, record.email)
            return {
              data: {
                ...newUser,
                name: record.name.trim() || derived,
                username: derived,
                displayUsername: derived,
              },
            }
          },
        },
      },
    },
    plugins: [username({ immutableUsername: true }), tanstackStartCookies()],
  })
}

export type Auth = ReturnType<typeof createAuth>

/**
 * A username for an account that signed up without choosing one (Google):
 * the part of the e-mail address before the @, normalised like any
 * username, with a number appended when it is taken.
 */
async function freeUsername(db: Database, email: string): Promise<string> {
  const local = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
  const base = (local.length >= 3 ? local : `${local}spieler`).slice(0, 27)
  for (let suffix = 1; ; suffix++) {
    const candidate = suffix === 1 ? base : `${base}${suffix}`
    const taken = await db.query.user.findFirst({
      where: eq(schema.user.username, candidate),
      columns: { id: true },
    })
    if (!taken) return candidate
  }
}
