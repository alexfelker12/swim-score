import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  AuthPage,
  AuthPageDescription,
  AuthPageTitle,
} from "@/components/auth-page"
import {
  LinkGone,
  LinkGoneContent,
  LinkGoneDescription,
  LinkGoneFooter,
  LinkGoneTitle,
} from "@/components/link-gone"
import { PasswordInput } from "@/components/password-input"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel, FieldNote } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
    <AuthPage back="/sign-in">
      <AuthPageTitle>Neues Passwort</AuthPageTitle>
      <AuthPageDescription>
        Für das Konto <strong>{username}</strong>. Danach meldest du dich damit
        an.
      </AuthPageDescription>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {/* For password managers: which account the new password is for. */}
        <Input
          type="text"
          name="username"
          autoComplete="username"
          value={username}
          readOnly
          hidden
        />
        <Field data-invalid={errors.password ? true : undefined}>
          <FieldLabel htmlFor="reset-password-new">Neues Passwort</FieldLabel>
          <PasswordInput
            id="reset-password-new"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby="reset-password-new-note"
          />
          <FieldNote id="reset-password-new-note" error={errors.password}>
            Mindestens 8 Zeichen.
          </FieldNote>
        </Field>
        <Field data-invalid={errors.confirmation ? true : undefined}>
          <FieldLabel htmlFor="reset-password-confirm">
            Passwort bestätigen
          </FieldLabel>
          <PasswordInput
            id="reset-password-confirm"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            aria-invalid={errors.confirmation ? true : undefined}
            aria-describedby={
              errors.confirmation ? "reset-password-confirm-error" : undefined
            }
          />
          <FieldError id="reset-password-confirm-error">
            {errors.confirmation}
          </FieldError>
        </Field>
        <Button type="submit" size="xl" disabled={pending} className="mt-1">
          Passwort speichern
        </Button>
      </form>
    </AuthPage>
  )
}

function LinkExpired() {
  return (
    <LinkGone>
      <LinkGoneContent>
        <LinkGoneTitle>Dieser Link gilt nicht mehr</LinkGoneTitle>
        <LinkGoneDescription>
          Ein Link zum Zurücksetzen gilt eine Stunde und nur einmal. Fordere
          einfach einen neuen an.
        </LinkGoneDescription>
      </LinkGoneContent>
      <LinkGoneFooter>
        <Button
          size="xl"
          nativeButton={false}
          render={<Link to="/forgot-password" />}
        >
          Neuen Link anfordern
        </Button>
      </LinkGoneFooter>
    </LinkGone>
  )
}
