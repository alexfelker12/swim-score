import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { authError } from "@/lib/auth-messages"
import { GoogleButton } from "./google-button"
import { Logo } from "./logo"
import type { ReactNode } from "react"

/** Frame of the sign-in and sign-up pages: logo header, title, content. */
export function AuthPage({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-18 shrink-0 items-center px-6">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col gap-5 px-6 pt-3 pb-7">
        <h1 className="text-[30px] font-bold tracking-[-0.01em]">{title}</h1>
        {children}
      </main>
    </div>
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
      <GoogleButton
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
        {label}
      </GoogleButton>
      {error ? (
        <p role="alert" className="-mt-2 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </>
  )
}
