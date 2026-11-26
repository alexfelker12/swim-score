import type { QueryClient, QueryKey } from "@tanstack/react-query"

// Pages change at once (#58): opening a page in the browser, a loader only
// starts loading the page's data, the router changes the page right away
// (one transition, ADR 0014) and the page shows its loading state
// (`pendingComponent`) until `useSuspenseQuery` has the data. Data already in
// the cache shows at once, without a loading state.
//
// The loader still waits on the server, so the page arrives rendered, and
// within a page that stays (a tab, a period, loading again): there the page
// keeps showing until the new data is there instead of turning into its
// loading state.

/**
 * Runs a loader's loading: only starts it when the browser opens the page,
 * else waits for it. A failure while not waiting (no connection, a page that
 * doesn't exist) shows in the page itself: `useSuspenseQuery` throws the
 * error, and the page shows `PageNotFound` for missing data.
 */
export function loadPageData(
  cause: "enter" | "stay" | "preload",
  load: () => Promise<unknown>
) {
  const loading = load()
  if (typeof window === "undefined" || cause === "stay") return loading
  loading.catch(() => {})
  return undefined
}

/**
 * For a form that starts from its data ("Neues Spiel"): cached data that has
 * gone stale or was invalidated is dropped before the page opens, so the
 * page shows its loading state and starts from fresh data instead of from
 * old data that changes under it. Not while a page shows the data.
 */
export function dropIfStale(queryClient: QueryClient, queryKey: QueryKey) {
  const query = queryClient.getQueryCache().find({ queryKey, exact: true })
  if (!query || query.getObserversCount() > 0) return
  const staleTime = queryClient.getDefaultOptions().queries?.staleTime
  const stale =
    query.state.isInvalidated ||
    Date.now() - query.state.dataUpdatedAt >
      (typeof staleTime === "number" ? staleTime : 0)
  if (stale) queryClient.removeQueries({ queryKey, exact: true })
}
