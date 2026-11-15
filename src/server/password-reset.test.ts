import { eq, like } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { verification } from "./db/schema"
import { getPasswordResetAccount } from "./password-reset"
import { createTestApp, signUp } from "./testing/test-app"
import type { TestApp } from "./testing/test-app"

/** Asks for a reset link the way the "Passwort vergessen" page does. */
function requestReset(app: TestApp, email: string) {
  return app.auth.api.requestPasswordReset({
    body: { email, redirectTo: "/reset-password" },
  })
}

/** The token from the link in the last mail of the outbox. */
function tokenFromLastMail(app: TestApp): string {
  const mail = app.outbox.at(-1)
  const match = mail?.text.match(/\/reset-password\/([^?\s]+)\?/)
  if (!match) throw new Error("No reset link in the last mail")
  return match[1]
}

function signIn(app: TestApp, username: string, password: string) {
  return app.auth.api.signInUsername({ body: { username, password } })
}

describe("Passwort zurücksetzen", () => {
  it("mails a link that opens 'Neues Passwort' for the account", async () => {
    const app = await createTestApp()
    await signUp(app.auth, { username: "Anna", email: "anna@beispiel.de" })

    await requestReset(app, "anna@beispiel.de")

    expect(app.outbox).toHaveLength(1)
    const [mail] = app.outbox
    expect(mail.to).toBe("anna@beispiel.de")
    expect(mail.subject).toBe("Neues Passwort für Swim Score")
    // The link goes through better-auth, which checks it and then opens
    // the page with the token.
    expect(mail.text).toContain(
      "http://localhost:3000/api/auth/reset-password/"
    )
    expect(mail.text).toContain("callbackURL=%2Freset-password")
    expect(mail.text).toContain("eine Stunde")
    expect(mail.html).toContain(">Neues Passwort setzen</a>")
    expect(
      await getPasswordResetAccount(app, { token: tokenFromLastMail(app) })
    ).toEqual({ username: "anna" })
  })

  it("answers the same whether or not the address has an account", async () => {
    const app = await createTestApp()
    await signUp(app.auth, { username: "Anna", email: "anna@beispiel.de" })

    const known = await requestReset(app, "anna@beispiel.de")
    const unknown = await requestReset(app, "niemand@beispiel.de")

    expect(unknown).toEqual(known)
    expect(app.outbox.map((m) => m.to)).toEqual(["anna@beispiel.de"])
  })

  it("does not tell when sending the mail fails", async () => {
    const app = await createTestApp({
      mailer: {
        send: async () => {
          throw new Error("Resend is down")
        },
      },
    })
    await signUp(app.auth, { username: "Anna", email: "anna@beispiel.de" })

    await expect(requestReset(app, "anna@beispiel.de")).resolves.toEqual(
      await requestReset(app, "niemand@beispiel.de")
    )
  })

  it("answers before the e-mail is sent, so timing tells nothing either", async () => {
    const background: Array<Promise<unknown>> = []
    let sent = false
    const app = await createTestApp({
      // Resend that takes its time.
      mailer: {
        send: () =>
          new Promise((resolve) =>
            setTimeout(() => {
              sent = true
              resolve()
            }, 200)
          ),
      },
      runInBackground: (task) => {
        background.push(task)
      },
    })
    await signUp(app.auth, { username: "Anna", email: "anna@beispiel.de" })

    await requestReset(app, "anna@beispiel.de")

    expect(sent).toBe(false)
    await Promise.all(background)
    expect(sent).toBe(true)
  })

  it("sets the new password once, and signs out everywhere", async () => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, {
      username: "Anna",
      email: "anna@beispiel.de",
    })
    await requestReset(app, "anna@beispiel.de")
    const token = tokenFromLastMail(app)

    await app.auth.api.resetPassword({
      body: { token, newPassword: "ganz-neu-123" },
    })

    await expect(signIn(app, "anna", "ganz-neu-123")).resolves.toMatchObject({
      user: { username: "anna" },
    })
    await expect(signIn(app, "anna", "geheim123")).rejects.toThrow()
    expect(await app.auth.api.getSession({ headers: anna.headers })).toBeNull()
    // The link works only once.
    expect(await getPasswordResetAccount(app, { token })).toBeNull()
    await expect(
      app.auth.api.resetPassword({
        body: { token, newPassword: "noch-einmal-123" },
      })
    ).rejects.toThrow()
  })

  it("lets the link expire after an hour", async () => {
    const app = await createTestApp()
    await signUp(app.auth, { username: "Anna", email: "anna@beispiel.de" })
    const before = Date.now()
    await requestReset(app, "anna@beispiel.de")
    const token = tokenFromLastMail(app)

    const [stored] = await app.db
      .select({ expiresAt: verification.expiresAt })
      .from(verification)
      .where(like(verification.identifier, "reset-password:%"))
    expect(stored.expiresAt.getTime() - before).toBeGreaterThan(59 * 60_000)
    expect(stored.expiresAt.getTime() - before).toBeLessThan(61 * 60_000)

    await app.db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(verification.identifier, `reset-password:${token}`))

    expect(await getPasswordResetAccount(app, { token })).toBeNull()
    await expect(
      app.auth.api.resetPassword({
        body: { token, newPassword: "zu-spaet-123" },
      })
    ).rejects.toThrow()
  })

  it("knows no account for a made-up link", async () => {
    const app = await createTestApp()

    expect(
      await getPasswordResetAccount(app, { token: "ausgedacht" })
    ).toBeNull()
  })
})
