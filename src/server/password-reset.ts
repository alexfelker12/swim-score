import { eq } from "drizzle-orm"
import { user } from "./db/schema"
import type { App } from "./app"
import type { Email } from "./email"

/**
 * The account a reset link belongs to, for "Für das Konto anna" on "Neues
 * Passwort"; null when the link is unknown, used or expired. Needs no
 * session: whoever holds a valid link may know whose it is.
 */
export async function getPasswordResetAccount(
  app: App,
  input: { token: string }
): Promise<{ username: string } | null> {
  const context = await app.auth.$context
  const stored = await context.internalAdapter.findVerificationValue(
    `reset-password:${input.token}`
  )
  if (!stored || stored.expiresAt < app.now()) return null
  const account = await app.db.query.user.findFirst({
    where: eq(user.id, stored.value),
    columns: { username: true },
  })
  // The username is what the account signs in with, so it is the one shown.
  if (!account?.username) return null
  return { username: account.username }
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] ?? c
  )

/** The e-mail with the link to "Neues Passwort", valid for an hour. */
export function passwordResetEmail({
  to,
  name,
  username,
  url,
}: {
  to: string
  /** Display Name, for the greeting. */
  name: string
  /** The username the account signs in with. */
  username: string
  url: string
}): Email {
  const intro = `du hast ein neues Passwort für dein Konto ${username} angefordert. Mit diesem Link setzt du es, er gilt eine Stunde:`
  const outro =
    "Wenn du das nicht warst, ignorier diese E-Mail einfach. Dein Passwort bleibt dann, wie es ist."
  return {
    to,
    subject: "Neues Passwort für Swim Score",
    text: `Hallo ${name},\n\n${intro}\n\n${url}\n\n${outro}\n`,
    html: [
      `<p>Hallo ${escapeHtml(name)},</p>`,
      `<p>${escapeHtml(intro)}</p>`,
      `<p><a href="${escapeHtml(url)}">Neues Passwort setzen</a></p>`,
      `<p>${escapeHtml(outro)}</p>`,
    ].join("\n"),
  }
}
