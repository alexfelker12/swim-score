import { useSyncExternalStore } from "react"
import { isIos } from "@/lib/platform"

// Whether and how Swim Score can be installed on this device, for the hint
// in the profile. Chrome on Android announces it with `beforeinstallprompt`
// and shows its own dialog when asked; iOS has no such event, there it only
// works through "Teilen → Zum Home-Bildschirm".
//
// The event can come before the profile is open, so it is caught as soon as
// this module loads (it is imported by the root route).

/** Chrome's install event, not in the DOM typings. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * - `installed`: running as the installed app, nothing to offer
 * - `prompt`: the browser can show its install dialog
 * - `ios`: iOS, install through the share menu
 * - `none`: nothing known (e.g. desktop, or the browser didn't offer it)
 */
export type InstallOption = "installed" | "prompt" | "ios" | "none"

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep the browser's own mini bar away; the profile offers it instead.
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    installed = true
    notify()
  })
}

function isStandalone() {
  return (
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function currentOption(): InstallOption {
  if (installed || isStandalone()) return "installed"
  if (deferredPrompt) return "prompt"
  if (isIos()) return "ios"
  return "none"
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** How this device can install the app, and the browser's dialog. */
export function useInstallApp() {
  const option = useSyncExternalStore(
    subscribe,
    currentOption,
    () => "none" as const
  )
  return {
    option,
    /** Shows the browser's install dialog (only for `prompt`). */
    async install() {
      const event = deferredPrompt
      if (!event) return
      await event.prompt()
      const { outcome } = await event.userChoice
      // The event works only once; Chrome sends a new one if it may ask again.
      deferredPrompt = null
      if (outcome === "accepted") installed = true
      notify()
    },
  }
}
