import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import * as schema from "../db/schema"
import { createAuth } from "../auth"
import type { GoogleProfile as GoogleIdToken } from "better-auth/social-providers"
import type { App, Notifier } from "../app"

export type GoogleProfile = {
  sub: string
  email: string
  name: string
  picture?: string
}

/** A test application that also keeps every Game-changed notification it sent. */
export type TestApp = App & {
  notifications: Array<{ gameId: string; version: number }>
}

/**
 * A complete server application on a fresh in-memory Postgres (PGlite),
 * with the real migrations applied. Google sign-in accepts any ID token that
 * is a JSON-encoded `GoogleProfile`. Notifications are kept in
 * `notifications` instead of going to Pusher, unless `notifier` replaces them.
 */
export async function createTestApp({
  notifier,
}: { notifier?: Notifier } = {}): Promise<TestApp> {
  const client = new PGlite()
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder: "drizzle" })
  const auth = createAuth({
    db,
    baseURL: "http://localhost:3000",
    secret: "test-secret-that-is-long-enough-for-better-auth",
    google: {
      clientId: "test-client",
      clientSecret: "test-secret",
      verifyIdToken: async () => true,
      getUserInfo: async (tokens) => {
        const profile = JSON.parse(tokens.idToken ?? "{}") as GoogleProfile
        return {
          user: {
            email: profile.email,
            name: profile.name,
            image: profile.picture,
            emailVerified: true,
          },
          // Only the claims better-auth reads; the rest of a real ID token is
          // irrelevant here.
          data: {
            ...profile,
            email_verified: true,
          } as unknown as GoogleIdToken,
        }
      },
    },
  })
  const notifications: TestApp["notifications"] = []
  return {
    db,
    auth,
    now: () => new Date(),
    notifier: notifier ?? {
      gameChanged: async (gameId, version) => {
        notifications.push({ gameId, version })
      },
    },
    notifications,
  }
}

type Auth = App["auth"]

/** Signs a person up with username and password and returns their session headers. */
export async function signUp(
  auth: Auth,
  {
    username,
    email = `${username.toLowerCase()}@example.com`,
    password = "geheim123",
  }: { username: string; email?: string; password?: string }
) {
  const response = await auth.api.signUpEmail({
    body: { username, email, password, name: "" },
    asResponse: true,
  })
  if (!response.ok) throw await response.json().then((body) => ({ body }))
  const { user } = (await response.json()) as { user: { id: string } }
  return { user, headers: sessionHeaders(response) }
}

/** Signs in with Google as the given profile and returns the user and session headers. */
export async function signInWithGoogle(auth: Auth, profile: GoogleProfile) {
  const response = await auth.api.signInSocial({
    body: { provider: "google", idToken: { token: JSON.stringify(profile) } },
    asResponse: true,
  })
  if (!response.ok) throw await response.json().then((body) => ({ body }))
  const headers = sessionHeaders(response)
  const session = await auth.api.getSession({ headers })
  if (!session) throw new Error("Google sign-in did not create a session")
  return { user: session.user, headers }
}

function sessionHeaders(response: Response): Headers {
  const cookies = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
  return new Headers({ cookie: cookies.join("; ") })
}
