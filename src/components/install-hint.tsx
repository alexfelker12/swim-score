import { Download, Share, X } from "lucide-react"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useInstallApp, useInstallHintClosed } from "@/lib/install-app"

/**
 * "Swim Score als App", compact and floating at the bottom of the start
 * page (#58), since the entry in the profile alone is easy to miss: on
 * Android with "Installieren", on iOS with the way through the share menu.
 * Closed, it stays closed on this device; the profile keeps the entry.
 * Nothing in the installed app or where the browser can't install it.
 */
export function InstallHint() {
  const { option, install } = useInstallApp()
  const { closed, close } = useInstallHintClosed()
  if (closed || (option !== "prompt" && option !== "ios")) return null
  return (
    <div className="sticky bottom-0 mt-auto px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <Alert variant="floating" size="compact">
        {option === "prompt" ? <Download /> : <Share />}
        <AlertTitle>Swim Score als App</AlertTitle>
        <AlertDescription>
          {option === "prompt"
            ? "Ohne Browserleiste"
            : "Teilen, dann „Zum Home-Bildschirm“"}
        </AlertDescription>
        <AlertAction>
          {option === "prompt" ? (
            <Button size="xs" onClick={() => void install()}>
              Installieren
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Hinweis schließen"
            onClick={close}
          >
            <X />
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}
