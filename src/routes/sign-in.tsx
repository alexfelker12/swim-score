import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { CircleCheck } from "lucide-react"
import {
  AuthPage,
  AuthPageFooter,
  AuthPageTitle,
  GoogleSignIn,
} from "@/components/auth-page"
import { PasswordInput } from "@/components/password-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { authError } from "@/lib/auth-messages"
import { safeRedirect } from "@/lib/safe-redirect"
import { getPasswordResetAvailableFn } from "@/server/functions"

type Search = {
  redirect?: string
  error?: string
  /** Back from "Neues Passwort": the new password is saved. */
  reset?: true
}

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search): Search => ({
    ...(typeof search.redirect === "string" && { redirect: search.redirect }),
    ...(typeof search.error === "string" && { error: search.error }),
    ...(search.reset === true && { reset: true as const }),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.viewer) throw redirect({ href: safeRedirect(search.redirect) })
  },
  // Without e-mail there is no way to reset a password: no link to offer.
  loader: async () => ({
    passwordReset: await getPasswordResetAvailableFn(),
  }),
  component: SignIn,
})

function SignIn() {
  const search = Route.useSearch()
  const { passwordReset } = Route.useLoaderData()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<
    Partial<Record<"username" | "password", string>>
  >({})

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const missing: typeof errors = {}
    if (!username.trim()) missing.username = "Gib deinen Benutzernamen ein."
    if (!password) missing.password = "Gib dein Passwort ein."
    setErrors(missing)
    if (Object.keys(missing).length > 0) return

    setPending(true)
    const { error } = await authClient.signIn.username({ username, password })
    if (error) {
      const { field, message } = authError(error.code)
      setErrors({ [field === "username" ? "username" : "password"]: message })
      setPending(false)
      return
    }
    // Nothing loaded for an earlier account may show for this one.
    queryClient.clear()
    // Reloading the route runs its beforeLoad, which now sends the signed-in
    // account on to the original page.
    await router.invalidate()
  }

  return (
    <AuthPage>
      <AuthPageTitle>Anmelden</AuthPageTitle>
      {search.reset ? (
        <Alert>
          <CircleCheck />
          <AlertDescription>
            Dein neues Passwort ist gespeichert. Melde dich jetzt damit an.
          </AlertDescription>
        </Alert>
      ) : null}
      <GoogleSignIn
        label="Mit Google anmelden"
        redirect={safeRedirect(search.redirect)}
        initialError={search.error}
      />
      <FieldSeparator>oder</FieldSeparator>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field data-invalid={errors.username ? true : undefined}>
          <FieldLabel htmlFor="sign-in-username">Benutzername</FieldLabel>
          <Input
            id="sign-in-username"
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={errors.username ? true : undefined}
            aria-describedby={
              errors.username ? "sign-in-username-error" : undefined
            }
          />
          <FieldError id="sign-in-username-error">{errors.username}</FieldError>
        </Field>
        <Field data-invalid={errors.password ? true : undefined}>
          <FieldLabel htmlFor="sign-in-password">Passwort</FieldLabel>
          <PasswordInput
            id="sign-in-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={
              errors.password ? "sign-in-password-error" : undefined
            }
          />
          <FieldError id="sign-in-password-error">{errors.password}</FieldError>
        </Field>
        {passwordReset ? (
          <Button
            variant="link"
            size="lg"
            nativeButton={false}
            render={<Link to="/forgot-password" />}
            className="-mt-1 self-end"
          >
            Passwort vergessen?
          </Button>
        ) : null}
        <Button type="submit" size="xl" disabled={pending} className="mt-1">
          Anmelden
        </Button>
      </form>
      <AuthPageFooter>
        Noch kein Konto?{" "}
        <Button
          variant="link"
          nativeButton={false}
          render={<Link to="/sign-up" search={{ redirect: search.redirect }} />}
        >
          Registrieren
        </Button>
      </AuthPageFooter>
    </AuthPage>
  )
}
