import { cloneElement, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import type { ReactElement } from "react"
import type { PagedList } from "@/lib/paged-query"

/**
 * The end of a list loaded a page at a time (#59, `usePagedQuery`): while
 * more follow, two placeholders (`placeholder`, in the layout of an entry),
 * and the next page loads when they come near the screen. Without a connection,
 * "Weitere laden" tries again. Nothing at the list's real end.
 *
 * ```tsx
 * const games = usePagedQuery(groupGamesQuery(groupId))
 * {games.items.map(…)}
 * <ListEnd
 *   list={games}
 *   placeholder={<Skeleton variant="card" className="h-20" />}
 * />
 * ```
 */
export function ListEnd({
  list,
  placeholder,
}: {
  list: PagedList
  placeholder: ReactElement
}) {
  const end = useRef<HTMLDivElement>(null)
  const loadMore = useRef(list.loadMore)
  loadMore.current = list.loadMore
  const waiting = list.hasMore && !list.loadingMore && !list.failed

  useEffect(() => {
    // The wrapper has no box of its own (it keeps the list's gaps); the first
    // placeholder is what comes into view.
    const element = end.current?.firstElementChild
    if (!waiting || !element) return
    // A little ahead of the screen, so the next page is usually there in time.
    // Observing anew after each page loads it again while the end is in view.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore.current()
      },
      { rootMargin: "0px 0px 600px 0px" }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [waiting])

  if (!list.hasMore) return null
  if (list.failed) {
    return (
      <Button variant="ghost" onClick={list.loadMore}>
        Weitere laden
      </Button>
    )
  }
  return (
    <div
      ref={end}
      data-slot="list-end"
      role="status"
      aria-label="Lädt weitere"
      className="contents"
    >
      {cloneElement(placeholder, { key: 1 })}
      {cloneElement(placeholder, { key: 2 })}
    </div>
  )
}
