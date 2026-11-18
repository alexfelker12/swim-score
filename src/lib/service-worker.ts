import { useSyncExternalStore } from "react"

// Registers the service worker (ADR 0011) and tells the app when a new
// version waits. Only in production builds; in development nothing is
// registered.
//
// A new version never takes over on its own: it waits until "Aktualisieren"
// is tapped, then this page reloads with it. Other pages of the app that
// are open at the same time keep running and only get the new files on
// their next load.

let waiting: ServiceWorker | null = null
/** This page asked for the update and reloads when it is active. */
let updating = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

/** Registers the service worker once; called when the app has loaded. */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return
  const container = navigator.serviceWorker
  if (!import.meta.env.PROD) {
    // A worker from a production build on the same address (e.g. after
    // `vite preview`) would otherwise keep answering in development.
    void container
      .getRegistrations()
      .then((all) => all.forEach((registration) => registration.unregister()))
    return
  }

  container.addEventListener("controllerchange", () => {
    if (updating) window.location.reload()
  })

  void container
    .register("/sw.js")
    .then((registration) => {
      const check = () => {
        // Without a controller this is the first install: nothing to update.
        if (registration.waiting && container.controller) {
          waiting = registration.waiting
          notify()
        }
      }
      check()
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed") check()
        })
      })
      // The installed app stays open for long; look for a new version
      // whenever it comes to the front again.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          void registration.update().catch(() => {
            // Offline: try again next time.
          })
        }
      })
    })
    .catch(() => {
      // Without a service worker the app works as before, only not offline.
    })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Whether a new version waits, and how to switch to it. */
export function useAppUpdate() {
  const available = useSyncExternalStore(
    subscribe,
    () => waiting !== null,
    () => false
  )
  return {
    available,
    /** Activates the new version; the page reloads once it has taken over. */
    update() {
      if (!waiting) return
      updating = true
      waiting.postMessage({ type: "SKIP_WAITING" })
    },
  }
}
