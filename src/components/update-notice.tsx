import { useState, useSyncExternalStore } from "react"
import { RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useAppUpdate } from "@/lib/service-worker"
import { hasWaitingSteps, subscribeWaitingSteps } from "@/lib/waiting-steps"

/**
 * "Neue Version verfügbar" with "Aktualisieren", floating at the top while
 * a new version of the app waits (#51). Hidden while steps of a Game wait
 * to be sent and without a connection, so the app never reloads in the
 * middle of counting; "Später" hides it until the next start.
 */
export function UpdateNotice() {
  const { available, update } = useAppUpdate()
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  )
  const stepsWaiting = useSyncExternalStore(
    subscribeWaitingSteps,
    hasWaitingSteps,
    () => false
  )
  const [dismissed, setDismissed] = useState(false)
  if (!available || !online || stepsWaiting || dismissed) return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto max-w-[500px] px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] [view-transition-name:update-notice]">
      <Alert variant="floating">
        <RefreshCw />
        <AlertTitle>Neue Version verfügbar</AlertTitle>
        <AlertDescription className="flex gap-2 pt-2">
          <Button size="xs" onClick={update}>
            Aktualisieren
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setDismissed(true)}>
            Später
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener)
  window.addEventListener("offline", listener)
  return () => {
    window.removeEventListener("online", listener)
    window.removeEventListener("offline", listener)
  }
}
