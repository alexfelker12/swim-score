import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Mail } from "lucide-react"
import {
  AuthPage,
  AuthPageDescription,
  AuthPageTitle,
} from "@/components/auth-page"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { authError } from "@/lib/auth-messages"
import { getPasswordResetAvailableFn } from "@/server/functions"

/** "Passwort vergessen": asks for the account's address and mails a link. */
export const Route = createFileRoute("/forgot-password")({
  loader: async () => ({ available: await getPasswordResetAvailableFn() }),
  component: ForgotPassword,
})

function ForgotPassword() {
  const { available } = Route.useLoaderData()
  if (!available) return <NotAvailable />
  return <ForgotPasswordForm />
}

/** Opened by its address while no e-mail can be sent (no link leads here then). */
function NotAvailable() {
  return (
    <AuthPage back="/sign-in">
      <AuthPageTitle>Passwort vergessen</AuthPageTitle>
      <AuthPageDescription>
        Zurücksetzen per E-Mail ist noch nicht eingerichtet. Melde dich mit
        Google an, falls dein Konto damit verbunden ist.
      </AuthPageDescription>
    </AuthPage>
  )
}

function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!email.trim()) {
      setError("Gib deine E-Mail-Adresse ein.")
      return
    }
    setError(null)
    setPending(true)
    const { error: failure } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset-password",
    })
    setPending(false)
    if (failure) {
      setSent(false)
      setError(authError(failure.code).message)
      return
    }
    // The same for every address: whether it has an account stays unsaid.
    setSent(true)
  }

  return (
    <AuthPage back="/sign-in">
      <AuthPageTitle>Passwort vergessen</AuthPageTitle>
      <AuthPageDescription>
        Gib die E-Mail-Adresse deines Kontos ein. Wir schicken dir einen Link,
        mit dem du ein neues Passwort setzt.
      </AuthPageDescription>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="forgot-password-email">E-Mail</FieldLabel>
          <Input
            id="forgot-password-email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setSent(false)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "forgot-password-email-error" : undefined}
          />
          <FieldError id="forgot-password-email-error">{error}</FieldError>
        </Field>
        <Button type="submit" size="xl" disabled={pending}>
          Link senden
        </Button>
      </form>
      {sent ? (
        <Alert>
          <Mail />
          <AlertDescription>
            Wenn es zu dieser Adresse ein Konto gibt, ist der Link unterwegs. Er
            gilt eine Stunde und führt zu „Neues Passwort“. Schau auch im
            Spam-Ordner nach.
          </AlertDescription>
        </Alert>
      ) : null}
    </AuthPage>
  )
}
