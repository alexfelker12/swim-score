import type { Auth } from "./auth"
import type { Database } from "./db"

/** Everything a server command needs: the database and the auth instance. */
export type App = {
  db: Database
  auth: Auth
}
