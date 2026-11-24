import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import {
  AuthPage,
  AuthPageFooter,
  AuthPageTitle,
  GoogleSignIn,
} from "@/components/auth-page"
import { PasswordInput } from "@/components/password-input"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldLabel,
  FieldNote,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { authError } from "@/lib/auth-messages"
import { safeRedirect } from "@/lib/safe-redirect"
import { reloadViewer } from "@/lib/viewer"

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
    await reloadViewer(router)
  }

  return (
    <AuthPage>
      <AuthPageTitle>Konto anlegen</AuthPageTitle>
      <GoogleSignIn label="Mit Google registrieren" redirect={target} />
      <FieldSeparator>oder</FieldSeparator>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field data-invalid={errors.username ? true : undefined}>
          <FieldLabel htmlFor="sign-up-username">Benutzername</FieldLabel>
          <Input
            id="sign-up-username"
            autoComplete="username"
            autoCapitalize="none"
            placeholder="z. B. emil_k"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={errors.username ? true : undefined}
            aria-describedby="sign-up-username-note"
          />
          <FieldNote id="sign-up-username-note" error={errors.username}>
            Damit meldest du dich an. Deinen Anzeigenamen änderst du später im
            Profil.
          </FieldNote>
        </Field>
        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="sign-up-email">E-Mail</FieldLabel>
          <Input
            id="sign-up-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby="sign-up-email-note"
          />
          <FieldNote id="sign-up-email-note" error={errors.email}>
            Nur für das Zurücksetzen des Passworts. Niemand in deinen Gruppen
            sieht sie.
          </FieldNote>
        </Field>
        <Field data-invalid={errors.password ? true : undefined}>
          <FieldLabel htmlFor="sign-up-password">Passwort</FieldLabel>
          <PasswordInput
            id="sign-up-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby="sign-up-password-note"
          />
          <FieldNote id="sign-up-password-note" error={errors.password}>
            Mindestens 8 Zeichen.
          </FieldNote>
        </Field>
        <Field data-invalid={errors.confirm ? true : undefined}>
          <FieldLabel htmlFor="sign-up-confirm">Passwort bestätigen</FieldLabel>
          <PasswordInput
            id="sign-up-confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={errors.confirm ? true : undefined}
            aria-describedby={
              errors.confirm ? "sign-up-confirm-error" : undefined
            }
          />
          <FieldError id="sign-up-confirm-error">{errors.confirm}</FieldError>
        </Field>
        <FieldError>{errors.form}</FieldError>
        <Button type="submit" size="xl" disabled={pending}>
          Konto anlegen
        </Button>
      </form>
      <AuthPageFooter>
        Schon ein Konto?{" "}
        <Button
          variant="link"
          nativeButton={false}
          render={<Link to="/sign-in" search={search} />}
        >
          Anmelden
        </Button>
      </AuthPageFooter>
    </AuthPage>
  )
}
