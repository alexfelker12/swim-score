import { eq } from "drizzle-orm"
import { group } from "../db/schema"
import { joinGroup } from "../invites"
import type { App } from "../app"

/** The Group's current Invite token, read past the Group Admin. */
export async function inviteToken(app: App, groupId: string): Promise<string> {
  const row = await app.db.query.group.findFirst({
    where: eq(group.id, groupId),
    columns: { inviteToken: true },
  })
  if (!row) throw new Error(`No group ${groupId}`)
  return row.inviteToken
}

/** Makes the signed-in account a new Player of the Group, via its Invite. */
export async function joinViaInvite(
  app: App,
  groupId: string,
  headers: Headers
) {
  await joinGroup(app, headers, { token: await inviteToken(app, groupId) })
}
