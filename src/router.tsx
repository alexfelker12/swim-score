import { QueryClient } from "@tanstack/react-query"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { routeTree } from "./routeTree.gen"

export type RouterContext = { queryClient: QueryClient }

export function getRouter() {
  // A new client per request on the server, one for the session in the browser.
  const queryClient = new QueryClient({
    // Data loaded on the server counts as fresh in the browser for a moment,
    // so it isn't fetched again right after the page appears.
    defaultOptions: { queries: { staleTime: 5_000 } },
  })
  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },

    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  })
  // Sends the server's query data along with the page and wraps the app in a
  // QueryClientProvider.
  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
