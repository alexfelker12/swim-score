import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Mail } from "lucide-react"
import { AuthPage } from "@/components/auth-page"
import { PrimaryButton } from "@/components/buttons"
import { Field, TextInput } from "@/components/form-field"
import { Notice } from "@/components/notice"
import { authClient } from "@/lib/auth-client"
import { authError } from "@/lib/auth-messages"

/** "Passwort vergessen": asks for the account's address and mails a link. */
export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
})

function ForgotPassword() {
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
    <AuthPage title="Passwort vergessen" back="/sign-in">
      <p className="text-lg text-pretty text-muted-foreground">
        Gib die E-Mail-Adresse deines Kontos ein. Wir schicken dir einen Link,
        mit dem du ein neues Passwort setzt.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="E-Mail" error={error ?? undefined}>
          {(field) => (
            <TextInput
              {...field}
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setSent(false)
              }}
            />
          )}
        </Field>
        <PrimaryButton type="submit" disabled={pending}>
          Link senden
        </PrimaryButton>
      </form>
      {sent ? (
        <Notice icon={Mail}>
          Wenn es zu dieser Adresse ein Konto gibt, ist der Link unterwegs. Er
          gilt eine Stunde und führt zu „Neues Passwort“. Schau auch im
          Spam-Ordner nach.
        </Notice>
      ) : null}
    </AuthPage>
  )
}
