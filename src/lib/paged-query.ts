import {
  infiniteQueryOptions,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query"
import { useMemo } from "react"
import { orKept } from "@/lib/kept-on-device"
import type { InfiniteData, QueryKey } from "@tanstack/react-query"
import type { KeptOnDevice } from "@/lib/kept-on-device"
import { DEFAULT_PAGE_SIZE } from "@/server/paging"
import type { Page, PageRequest } from "@/server/paging"

// Lists load a page at a time (#59): the first page with the page, the next
// one when the list's end comes into view (`ListEnd`). A list is a query of
// pages (TanStack Query's infinite query): invalidating it loads all pages
// shown again, from the first.

/**
 * A list loaded a page at a time: `queryFn` loads one page (`size` entries
 * after the cursor `after`). For loaders (`queryClient.fetchInfiniteQuery`)
 * and `usePagedQuery`. With `keptOnDevice`, the pages kept on the device
 * stand in without a connection (ADR 0012).
 */
export function pagedQueryOptions<TItem>({
  queryKey,
  queryFn,
  pageSize = DEFAULT_PAGE_SIZE,
  keptOnDevice,
}: {
  queryKey: QueryKey
  queryFn: (page: PageRequest) => Promise<Page<TItem>>
  pageSize?: number
  keptOnDevice?: KeptOnDevice
}) {
  return infiniteQueryOptions({
    queryKey,
    queryFn: ({ client, pageParam }) => {
      const load = () => queryFn({ size: pageSize, after: pageParam })
      if (!keptOnDevice) return load()
      return orKept(load, () => {
        const kept = client.getQueryData<InfiniteData<Page<TItem>>>(queryKey)
        return kept?.pages[kept.pageParams.indexOf(pageParam)]
      })
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<TItem>) => last.next,
    meta: keptOnDevice ? { keptOnDevice } : undefined,
  })
}

/**
 * The entries loaded so far of a paged list, and loading the next page;
 * suspends until the first page is there.
 */
export function usePagedQuery<TItem extends { id: string }>(
  options: ReturnType<typeof pagedQueryOptions<TItem>>
) {
  const query = useSuspenseInfiniteQuery(options)
  const items = useMemo(() => {
    // An entry whose place in the order changed between two pages (a Player
    // renamed, a Group that just played) may come twice: once is enough.
    const seen = new Set<string>()
    return query.data.pages
      .flatMap((page) => page.items)
      .filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
  }, [query.data])
  return {
    items,
    /** More pages follow. */
    hasMore: query.hasNextPage,
    /** The next page is on its way. */
    loadingMore: query.isFetchingNextPage,
    /** Loading the next page failed (no connection); `loadMore` tries again. */
    failed: query.isFetchNextPageError,
    /** Loads the next page, once, if there is one. */
    loadMore() {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage()
      }
    },
  }
}

/** What `ListEnd` needs of a paged list. */
export type PagedList = Omit<ReturnType<typeof usePagedQuery>, "items">
