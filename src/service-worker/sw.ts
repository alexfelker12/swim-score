// The service worker (ADR 0011). Built by the `serviceWorker` Vite plugin
// into /sw.js, which fills in the files of this build. It keeps the app's own
// files on the device so the app starts without a connection; it never
// keeps answers of the server (pages, server functions, sign-in, pictures).

// Type-checked with the worker types (tsconfig.sw.json), not the DOM ones.
const sw = self as unknown as ServiceWorkerGlobalScope

/** Paths of this build's files and the public files the app needs. */
const precache = "__SWIM_SCORE_PRECACHE__" as unknown as Array<string>
/** Changes with every build whose files changed. */
const version = "__SWIM_SCORE_VERSION__"

const cacheName = `swim-score-${version}`
/** Shown for a page that can't be loaded without a connection. */
const offlinePage = "/offline.html"
const precached = new Set(precache)
/**
 * How long a page may take before the offline page stands in: with poor
 * reception a request can hang instead of failing.
 */
const pageTimeoutMs = 10_000

sw.addEventListener("install", (event) => {
  // No skipWaiting: a new version waits until the app asks for it
  // ("Neue Version verfügbar" → "Aktualisieren").
  event.waitUntil(
    caches.open(cacheName).then((cache) =>
      // Past the browser's HTTP cache, so public files without a hash in
      // their name come fresh.
      cache.addAll(
        precache.map((path) => new Request(path, { cache: "reload" }))
      )
    )
  )
})

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Other open pages of the app still run the old version and may load
      // more of its files: its cache stays until only one page is open at
      // the next update.
      const pages = await sw.clients.matchAll({ type: "window" })
      if (pages.length <= 1) {
        for (const name of await caches.keys()) {
          if (name.startsWith("swim-score-") && name !== cacheName) {
            await caches.delete(name)
          }
        }
      }
      await sw.clients.claim()
    })()
  )
})

sw.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | null)?.type === "SKIP_WAITING") {
    void sw.skipWaiting()
  }
})

sw.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== sw.location.origin) return

  if (request.mode === "navigate") {
    // Pages always come from the server; only without a connection the
    // offline page stands in.
    event.respondWith(pageOrOffline(request))
    return
  }

  if (precached.has(url.pathname) || url.pathname.startsWith("/assets/")) {
    // Also built files of an older version still running in another page.
    event.respondWith(
      caches
        .match(request, { ignoreSearch: true })
        .then((cached) => cached ?? fetch(request))
    )
    return
  }
  // Everything else (server functions, /api/…) goes to the network as if
  // there were no service worker.
})

async function pageOrOffline(request: Request): Promise<Response> {
  const offline = async () =>
    (await caches.match(offlinePage)) ?? Response.error()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<Response>((resolve) => {
    timer = setTimeout(() => resolve(offline()), pageTimeoutMs)
  })
  try {
    return await Promise.race([fetch(request), timeout])
  } catch {
    return offline()
  } finally {
    clearTimeout(timer)
  }
}
