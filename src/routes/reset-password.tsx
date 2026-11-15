import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AuthPage } from "@/components/auth-page"
import { PrimaryButton } from "@/components/buttons"
import { Field, PasswordInput } from "@/components/form-field"
import { LinkGone } from "@/components/link-gone"
import { authClient } from "@/lib/auth-client"
import { authError } from "@/lib/auth-messages"
import { getPasswordResetAccountFn } from "@/server/functions"

type Search = { token?: string }

/**
 * "Neues Passwort": opened from the link in the e-mail. better-auth checks
 * the link first and adds `token`, or `error=INVALID_TOKEN` for a link that
 * is used or expired.
 */
export const Route = createFileRoute("/reset-password")({
  validateSearch: (search): Search =>
    typeof search.token === "string" ? { token: search.token } : {},
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps }) => ({
    account: deps.token
      ? await getPasswordResetAccountFn({ data: { token: deps.token } })
      : null,
  }),
  component: ResetPassword,
})

function ResetPassword() {
  const { token } = Route.useSearch()
  const { account } = Route.useLoaderData()
  const [expired, setExpired] = useState(false)
  if (!token || !account || expired) return <LinkExpired />
  return (
    <NewPasswordForm
      token={token}
      username={account.username}
      onExpired={() => setExpired(true)}
    />
  )
}

function NewPasswordForm({
  token,
  username,
  onExpired,
}: {
  token: string
  username: string
  onExpired: () => void
}) {
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<
    Partial<Record<"password" | "confirmation", string>>
  >({})

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const found: typeof errors = {}
    if (password.length < 8) found.password = "Mindestens 8 Zeichen."
    if (confirmation !== password) {
      found.confirmation = "Die beiden Passwörter sind nicht gleich."
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setPending(true)
    const { error } = await authClient.resetPassword({
      token,
      newPassword: password,
    })
    if (error) {
      setPending(false)
      if (error.code === "INVALID_TOKEN") onExpired()
      else setErrors({ password: authError(error.code).message })
      return
    }
    // Every session ended with the reset: sign in afresh.
    await navigate({ to: "/sign-in", search: { reset: true }, replace: true })
  }

  return (
    <AuthPage title="Neues Passwort" back="/sign-in">
      <p className="text-lg text-pretty text-muted-foreground">
        Für das Konto{" "}
        <strong className="font-semibold text-foreground">{username}</strong>.
        Danach meldest du dich damit an.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {/* For password managers: which account the new password is for. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={username}
          readOnly
          hidden
        />
        <Field
          label="Neues Passwort"
          hint="Mindestens 8 Zeichen."
          error={errors.password}
        >
          {(field) => (
            <PasswordInput
              {...field}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Field label="Passwort bestätigen" error={errors.confirmation}>
          {(field) => (
            <PasswordInput
              {...field}
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          )}
        </Field>
        <PrimaryButton type="submit" disabled={pending} className="mt-1">
          Passwort speichern
        </PrimaryButton>
      </form>
    </AuthPage>
  )
}

function LinkExpired() {
  return (
    <LinkGone
      title="Dieser Link gilt nicht mehr"
      action="Neuen Link anfordern"
      to="/forgot-password"
    >
      Ein Link zum Zurücksetzen gilt eine Stunde und nur einmal. Fordere einfach
      einen neuen an.
    </LinkGone>
  )
}
