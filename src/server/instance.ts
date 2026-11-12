import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./db/schema"
import { createAuth } from "./auth"
import { createPusher, pusherNotifier, silentNotifier } from "./pusher"
import type Pusher from "pusher"
import type { App } from "./app"

let app: App | undefined

/** The running server's application, built once from the environment. */
export function getApp(): App {
  if (app) return app
  const db = drizzle({
    client: postgres(requireEnv("DATABASE_URL"), { prepare: false }),
    schema,
  })
  const googleId = process.env.GOOGLE_CLIENT_ID
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET
  app = {
    db,
    auth: createAuth({
      db,
      baseURL: requireEnv("BETTER_AUTH_URL"),
      secret: requireEnv("BETTER_AUTH_SECRET"),
      google:
        googleId && googleSecret
          ? { clientId: googleId, clientSecret: googleSecret }
          : undefined,
    }),
    now: () => new Date(),
    notifier: createNotifier(),
  }
  return app
}

let pusher: Pusher | null | undefined

/**
 * Pusher when it is configured, else null: Games still work, just not live,
 * and nobody's presence is known.
 */
export function getPusher(): Pusher | null {
  if (pusher !== undefined) return pusher
  const appId = process.env.PUSHER_APP_ID
  const key = process.env.VITE_PUSHER_KEY
  const secret = process.env.PUSHER_SECRET
  const cluster = process.env.VITE_PUSHER_CLUSTER
  if (!appId || !key || !secret || !cluster) {
    console.warn("Pusher is not configured: Games are not updated live.")
    pusher = null
  } else {
    pusher = createPusher({ appId, key, secret, cluster })
  }
  return pusher
}

function createNotifier() {
  const connection = getPusher()
  return connection ? pusherNotifier(connection) : silentNotifier
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Environment variable ${name} is not set`)
  return value
}
