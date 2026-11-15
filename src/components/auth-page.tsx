import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { ChevronLeft } from "lucide-react"
import { GoogleIcon } from "@/components/icons/google-icon"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { authClient } from "@/lib/auth-client"
import { authError } from "@/lib/auth-messages"
import { cn } from "@/lib/utils"
import { Logo } from "./logo"
import type { ComponentProps, ReactNode } from "react"

/**
 * Frame of the account pages (sign-in, sign-up, password reset): logo
 * header, then the page's parts. With `back`, a way back left of the logo.
 *
 * ```tsx
 * <AuthPage back="/sign-in">
 *   <AuthPageTitle>Passwort vergessen</AuthPageTitle>
 *   <AuthPageDescription>…</AuthPageDescription>
 *   <form>…</form>
 *   <AuthPageFooter>…</AuthPageFooter>
 * </AuthPage>
 * ```
 */
export function AuthPage({
  back,
  children,
}: {
  back?: "/sign-in"
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header
        className={cn(
          "flex h-18 shrink-0 items-center",
          back ? "gap-3 px-3" : "px-6"
        )}
      >
        {back ? (
          <Button
            variant="ghost"
            size="icon"
            nativeButton={false}
            render={<Link to={back} />}
            aria-label="Zurück zur Anmeldung"
          >
            <ChevronLeft className="size-6" />
          </Button>
        ) : null}
        <Logo />
      </header>
      <main className="flex flex-1 flex-col gap-5 px-6 pt-3 pb-7">
        {children}
      </main>
    </div>
  )
}

/** The page heading, 30 px bold. */
export function AuthPageTitle({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      data-slot="auth-page-title"
      className={cn("text-[30px] font-bold tracking-[-0.01em]", className)}
      {...props}
    />
  )
}

/** Lead text under the heading; `<strong>` inside stands out (the account name). */
export function AuthPageDescription({
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      data-slot="auth-page-description"
      className={cn(
        "text-lg text-pretty text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground",
        className
      )}
      {...props}
    />
  )
}

/**
 * The way to the other account page ("Noch kein Konto? Registrieren"),
 * centred at the foot of the page.
 */
export function AuthPageFooter({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="auth-page-footer"
      className={cn(
        "mt-auto text-center text-[15px] text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

/** Continue with Google; comes back to `redirect` afterwards. */
export function GoogleSignIn({
  label,
  redirect,
  initialError,
}: {
  label: string
  redirect: string
  /** Error code better-auth appended when Google sent the person back. */
  initialError?: string
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(
    initialError ? authError(initialError).message : null
  )
  return (
    <>
      <Button
        variant="google"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError(null)
          const { error: failure } = await authClient.signIn.social({
            provider: "google",
            callbackURL: redirect,
            errorCallbackURL: `/sign-in?redirect=${encodeURIComponent(redirect)}`,
          })
          if (failure) {
            setError(authError(failure.code).message)
            setPending(false)
          }
        }}
      >
        <GoogleIcon />
        {label}
      </Button>
      <FieldError className="-mt-2">{error}</FieldError>
    </>
  )
}
