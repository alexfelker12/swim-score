import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { AuthPage, GoogleSignIn } from "@/components/auth-page"
import { PrimaryButton } from "@/components/buttons"
import { Field, PasswordInput, TextInput } from "@/components/form-field"
import { OrDivider } from "@/components/google-button"
import { authClient } from "@/lib/auth-client"
import { authError } from "@/lib/auth-messages"
import { safeRedirect } from "@/lib/safe-redirect"

type Search = { redirect?: string }

type Errors = Partial<
  Record<"username" | "email" | "password" | "confirm" | "form", string>
>

export const Route = createFileRoute("/sign-up")({
  validateSearch: (search): Search =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  beforeLoad: ({ context, search }) => {
    if (context.viewer) throw redirect({ href: safeRedirect(search.redirect) })
  },
  component: SignUp,
})

function SignUp() {
  const search = Route.useSearch()
  const target = safeRedirect(search.redirect)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<Errors>({})

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const found: Errors = {}
    if (username.trim().length < 3) found.username = "Mindestens 3 Zeichen."
    if (!email.includes("@"))
      found.email = "Das ist keine gültige E-Mail-Adresse."
    if (password.length < 8) found.password = "Mindestens 8 Zeichen."
    if (confirm !== password) {
      found.confirm = "Die beiden Passwörter sind nicht gleich."
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setPending(true)
    const { error } = await authClient.signUp.email({
      username: username.trim(),
      email: email.trim(),
      password,
      name: "",
    })
    if (error) {
      const { field, message } = authError(error.code)
      setErrors({ [field]: message })
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
    <AuthPage title="Konto anlegen">
      <GoogleSignIn label="Mit Google registrieren" redirect={target} />
      <OrDivider />
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field
          label="Benutzername"
          hint="Damit meldest du dich an. Deinen Anzeigenamen änderst du später im Profil."
          error={errors.username}
        >
          {(field) => (
            <TextInput
              {...field}
              autoComplete="username"
              autoCapitalize="none"
              placeholder="z. B. emil_k"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="E-Mail"
          hint="Nur für das Zurücksetzen des Passworts. Niemand in deinen Gruppen sieht sie."
          error={errors.email}
        >
          {(field) => (
            <TextInput
              {...field}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Passwort"
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
        <Field label="Passwort bestätigen" error={errors.confirm}>
          {(field) => (
            <PasswordInput
              {...field}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}
        </Field>
        {errors.form ? (
          <p role="alert" className="text-[13px] text-destructive">
            {errors.form}
          </p>
        ) : null}
        <PrimaryButton type="submit" disabled={pending}>
          Konto anlegen
        </PrimaryButton>
      </form>
      <p className="pt-1 text-center text-[15px] text-muted-foreground">
        Schon ein Konto?{" "}
        <Link
          to="/sign-in"
          search={search}
          className="font-semibold text-primary"
        >
          Anmelden
        </Link>
      </p>
    </AuthPage>
  )
}
