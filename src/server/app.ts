import type { Auth } from "./auth"
import type { Database } from "./db"

/**
 * Tells the devices showing a Game that it changed (ADR 0005): a
 * notification only, they load the Game again.
 */
export type Notifier = {
  gameChanged: (gameId: string, version: number) => Promise<void>
  /** The Scorekeeper's device connected or went offline. */
  scorekeeperPresenceChanged: (gameId: string) => Promise<void>
}

/**
 * Everything a server command needs: the database, the auth instance, the
 * clock and the realtime notifier.
 */
export type App = {
  db: Database
  auth: Auth
  /** The current time; tests set it to check time windows. */
  now: () => Date
  notifier: Notifier
}
