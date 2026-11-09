import { CommandError } from "./errors"
import type { App } from "./app"

/** The signed-in account, or a refusal when there is no valid session. */
export async function requireUser(app: App, headers: Headers) {
  const session = await app.auth.api.getSession({ headers })
  if (!session) throw new CommandError("notSignedIn")
  return session.user
}
