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
import { isUnreachable } from "@/lib/kept-on-device"

/**
 * The error shown for a page: "Keine Verbindung" with "Erneut versuchen"
 * when the server can't be reached (#51), anything else as before.
 */
export function PageError(props: ErrorComponentProps) {
  const router = useRouter()
  const offline = isUnreachable(props.error)
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
