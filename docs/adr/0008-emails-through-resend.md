# E-mails through Resend, sent after the response

"Passwort vergessen" (#16) is the first feature that sends e-mail. We send through Resend's HTTP API with a plain `fetch` (no SDK): the app sends a handful of e-mails, Resend's free tier covers that, and it needs no SMTP connection from a serverless function. better-auth creates the reset link and checks it; the app only builds the German e-mail and hands it to a `Mailer`.

better-auth waits for the e-mail to be sent before answering "Passwort vergessen" unless it is given a background-task handler. For an address with an account that wait includes the round trip to Resend, for an unknown one it does not, so the response time would tell whether an account exists. The e-mail is therefore sent after the response: on Vercel through `waitUntil` from `@vercel/functions`, which keeps the function alive until it is done.

## Considered Options

- **Resend SDK**: rejected, one POST request does not need a dependency.
- **SMTP (e.g. Nodemailer)**: rejected, a connection per request from a serverless function, and a mail account to keep.
- **Sending before the response, catching errors**: rejected, the answer would be the same but its timing would not.

## Consequences

- `createAuth` takes a `mailer` and an optional `runInBackground`; tests leave the latter out, so the e-mail is in `app.outbox` once the request returns.
- A failed send is logged and never changes the answer.
- Without `RESEND_API_KEY` and `EMAIL_FROM`, e-mails go to the server log in development, links included, so the flow can be tried locally. In production they go nowhere and nothing of them is logged: a logged reset link would hand the account to anyone who can read the logs. "Passwort vergessen" is then hidden on the sign-in page (`canSendEmail`), since it could not work.
- The sender must be on a domain verified in Resend.
- #36 (confirming a changed e-mail address) uses the same `Mailer`.
