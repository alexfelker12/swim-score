/** One e-mail, as plain text and as HTML. */
export type Email = {
  to: string
  subject: string
  text: string
  html: string
}

/**
 * Sends e-mails: through Resend in production, into the log in development,
 * and into an outbox in tests.
 */
export type Mailer = {
  send: (email: Email) => Promise<void>
}

/** Sends through the Resend API (https://resend.com/docs/api-reference). */
export function resendMailer({
  apiKey,
  from,
}: {
  apiKey: string
  /** A sender on a domain verified in Resend, e.g. "Swim Score <noreply@…>". */
  from: string
}): Mailer {
  return {
    async send(email) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ from, ...email }),
      })
      if (!response.ok) {
        throw new Error(
          `Resend refused the e-mail (${response.status}): ${await response.text()}`
        )
      }
    },
  }
}

/**
 * For development without Resend: the e-mail goes to the server log, links
 * included, enough to try "Passwort vergessen" locally. Never in production,
 * where a logged reset link would let anyone with log access take over the
 * account.
 */
export const loggingMailer: Mailer = {
  async send(email) {
    console.info(
      `E-mail to ${email.to} (Resend is not configured):\n${email.subject}\n\n${email.text}`
    )
  },
}

/** In production without Resend: nothing is sent, and nothing of it logged. */
export const unconfiguredMailer: Mailer = {
  async send() {
    throw new Error("Resend is not configured: e-mail not sent")
  },
}
