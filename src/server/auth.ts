import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { username } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { eq } from "drizzle-orm"
import * as schema from "./db/schema"
import { passwordResetEmail } from "./password-reset"
import type { GoogleOptions } from "better-auth/social-providers"
import type { Database } from "./db"
import type { Mailer } from "./email"

export type AuthConfig = {
  db: Database
  baseURL: string
  secret: string
  /** Sign-in with Google; left out where no credentials are configured. */
  google?: GoogleOptions
  /** Sends the "Passwort zurücksetzen" e-mails. */
  mailer: Mailer
  /**
   * Runs work after the response, so sending an e-mail does not delay it
   * (on Vercel: `waitUntil`). Without one, better-auth waits for the work.
   */
  runInBackground?: (task: Promise<unknown>) => void
}

export function createAuth({
  db,
  baseURL,
  secret,
  google,
  mailer,
  runInBackground,
}: AuthConfig) {
  return betterAuth({
    trustedOrigins: [
      "http://192.168.*.*:*/**",
      ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ],
    baseURL,
    secret,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    advanced: runInBackground
      ? {
          // Answering "Passwort vergessen" before the e-mail is sent keeps
          // known and unknown addresses equally fast (no hint by timing).
          backgroundTasks: { handler: runInBackground },
        }
      : undefined,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // "Passwort vergessen": the link is valid for an hour and works once.
      resetPasswordTokenExpiresIn: 60 * 60,
      // Whoever had the old password is signed out on every device.
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url }) {
        const account = user as typeof user & { username?: string | null }
        try {
          await mailer.send(
            passwordResetEmail({
              to: user.email,
              name: user.name,
              username: account.username ?? user.email,
              url,
            })
          )
        } catch (error) {
          // The answer must not differ from that for an unknown address.
          console.error("Password reset e-mail not sent:", error)
        }
      },
    },
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
  const base = usernameFromEmail(email)
  for (let suffix = 1; ; suffix++) {
    const candidate = suffix === 1 ? base : `${base}${suffix}`
    const taken = await db.query.user.findFirst({
      where: eq(schema.user.username, candidate),
      columns: { id: true },
    })
    if (!taken) return candidate
  }
}

/**
 * The username an account gets from its e-mail address before a number is
 * appended against collisions: the part before the @, normalised like any
 * username, at least 3 and at most 27 characters (room for the number).
 */
export function usernameFromEmail(email: string): string {
  const local = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
  return (local.length >= 3 ? local : `${local}spieler`).slice(0, 27)
}
