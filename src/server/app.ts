import type { Auth } from "./auth"
import type { Database } from "./db"

/** Everything a server command needs: the database, the auth instance and the clock. */
export type App = {
  db: Database
  auth: Auth
  /** The current time; tests set it to check time windows. */
  now: () => Date
}
