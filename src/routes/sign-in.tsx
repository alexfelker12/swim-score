import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { CircleCheck } from "lucide-react"
import { AuthPage, GoogleSignIn } from "@/components/auth-page"
import { PrimaryButton } from "@/components/buttons"
import { Field, PasswordInput, TextInput } from "@/components/form-field"
import { OrDivider } from "@/components/google-button"
import { Notice } from "@/components/notice"
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
    <AuthPage title="Anmelden">
      {search.reset ? (
        <Notice icon={CircleCheck}>
          Dein neues Passwort ist gespeichert. Melde dich jetzt damit an.
        </Notice>
      ) : null}
      <GoogleSignIn
        label="Mit Google anmelden"
        redirect={safeRedirect(search.redirect)}
        initialError={search.error}
      />
      <OrDivider />
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="Benutzername" error={errors.username}>
          {(field) => (
            <TextInput
              {...field}
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
        </Field>
        <Field label="Passwort" error={errors.password}>
          {(field) => (
            <PasswordInput
              {...field}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        {passwordReset ? (
          <Link
            to="/forgot-password"
            className="-mt-1 self-end py-1 text-[17px] font-semibold text-primary"
          >
            Passwort vergessen?
          </Link>
        ) : null}
        <PrimaryButton type="submit" disabled={pending} className="mt-1">
          Anmelden
        </PrimaryButton>
      </form>
      <div className="flex-1" />
      <p className="text-center text-[15px] text-muted-foreground">
        Noch kein Konto?{" "}
        <Link
          to="/sign-up"
          search={{ redirect: search.redirect }}
          className="font-semibold text-primary"
        >
          Registrieren
        </Link>
      </p>
    </AuthPage>
  )
}
