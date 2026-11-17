import { ErrorComponent, useRouter } from "@tanstack/react-router"
import { WifiOff } from "lucide-react"
import type { ErrorComponentProps } from "@tanstack/react-router"
import {
  LinkGone,
  LinkGoneContent,
  LinkGoneDescription,
  LinkGoneFooter,
  LinkGoneTitle,
} from "@/components/link-gone"
import { Button } from "@/components/ui/button"

/**
 * The error shown for a page: without a connection "Keine Verbindung" with
 * "Erneut versuchen" (#51), anything else as before. A server function that
 * can't reach the server fails with a `TypeError` (see ADR 0007).
 */
export function PageError(props: ErrorComponentProps) {
  const router = useRouter()
  const offline =
    props.error instanceof TypeError ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  if (!offline) return <ErrorComponent {...props} />

  return (
    <LinkGone>
      <LinkGoneContent>
        <LinkGoneTitle icon={WifiOff}>Keine Verbindung</LinkGoneTitle>
        <LinkGoneDescription>
          Diese Seite braucht eine Verbindung. Sobald du wieder online bist,
          geht es weiter.
        </LinkGoneDescription>
      </LinkGoneContent>
      <LinkGoneFooter>
        <Button size="xl" onClick={() => void router.invalidate()}>
          Erneut versuchen
        </Button>
      </LinkGoneFooter>
    </LinkGone>
  )
}
