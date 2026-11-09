import { player } from "../db/schema"
import type { App } from "../app"

/**
 * Makes an account a Player of a Group directly in the database. Stands in
 * for joining via an Invite until that exists (#11); replace it then.
 */
export async function joinGroup(app: App, groupId: string, userId: string) {
  await app.db
    .insert(player)
    .values({ id: crypto.randomUUID(), groupId, userId })
}
