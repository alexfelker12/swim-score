import { QueryClient } from "@tanstack/react-query"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { PageError } from "./components/page-error"
import { listenBeforeRouter } from "./lib/close-on-back"
import { isUnreachable, keepQueriesOnDevice } from "./lib/kept-on-device"
import { routeTree } from "./routeTree.gen"

export type RouterContext = { queryClient: QueryClient }

export function getRouter() {
  // Before the router takes over the browser history: sheets keep their own
  // entries in it, out of the router's sight (ADR 0013).
  listenBeforeRouter()
  // A new client per request on the server, one for the session in the browser.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data loaded on the server counts as fresh in the browser for a
        // moment, so it isn't fetched again right after the page appears.
        staleTime: 5_000,
        // Ask the server even when the browser reports itself offline:
        // otherwise queries would pause and a page would wait forever,
        // instead of showing what is kept or "Keine Verbindung" (ADR 0012).
        networkMode: "always",
        // While the server can't be reached, once more (a short gap) and not
        // three times, so "Keine Verbindung" comes soon.
        retry: (failures, error) => failures < (isUnreachable(error) ? 1 : 3),
      },
    },
  })
  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },

    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // The query cache decides what is fresh (ADR 0004). Without this the
    // router would show a page it has seen before at once, with whatever data
    // it rendered then, and reload in the background; a form such as "Neues
    // Spiel" would start from that old data. Loaders take fresh data from the
    // query cache, so waiting for them only costs time when something changed.
    defaultStaleReloadMode: "blocking",
    // "Keine Verbindung" instead of an error when the server can't be reached.
    defaultErrorComponent: PageError,
  })
  // Sends the server's query data along with the page and wraps the app in a
  // QueryClientProvider.
  setupRouterSsrQueryIntegration({ router, queryClient })
  // The start page and Games for opening without a connection (ADR 0012).
  keepQueriesOnDevice(queryClient)

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
