import type { Query, QueryClient, QueryKey } from "@tanstack/react-query"
import type { Viewer } from "@/server/functions"

// What the app keeps on the device so a running Game opens without a
// connection (ADR 0012): the signed-in Viewer and the queries marked with
// `keptOnDevice` (the start page and the Games), per account. When the server
// can't be reached the root route takes the remembered Viewer and the marked
// queries take what is kept; online everything comes from the server as
// before.
//
// Only the browser keeps anything; on the server every function here does
// nothing.

const viewerKey = "swim-score:kept:viewer"
const dataPrefix = "swim-score:kept:data:"
/** Kept queries per account besides the pinned ones; the oldest go first. */
const maxUnpinned = 12

/**
 * `meta` of a query kept on the device. Data whose fields match `pinnedWhen`
 * is never dropped to make room (a running Game must stay for
 * "Weiterzählen"). Plain data only: `meta` goes to the browser with the
 * page the server rendered.
 */
export type KeptOnDevice = { pinnedWhen?: Record<string, string> }

function isPinned(kept: KeptOnDevice, data: unknown) {
  const fields = Object.entries(kept.pinnedWhen ?? {})
  return (
    fields.length > 0 &&
    typeof data === "object" &&
    data !== null &&
    fields.every(
      ([field, value]) => (data as Record<string, unknown>)[field] === value
    )
  )
}

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: { keptOnDevice?: KeptOnDevice }
  }
}

/** Whether the server could not be reached, as opposed to any other error. */
export function isUnreachable(error: unknown): boolean {
  // fetch fails with a TypeError when there is no answer: "Failed to fetch"
  // (Chrome), "Load failed" (Safari), "NetworkError when attempting to fetch
  // resource" (Firefox). Other TypeErrors are mistakes in the code.
  return (
    error instanceof TypeError &&
    /failed to fetch|load failed|networkerror|network error/i.test(
      error.message
    )
  )
}

/**
 * Loads with `load`; when the server can't be reached, answers with what
 * `kept` has instead, if anything.
 */
export async function orKept<T>(
  load: () => Promise<T>,
  kept: () => T | null | undefined
): Promise<T> {
  try {
    return await load()
  } catch (error) {
    const fallback = isUnreachable(error) ? kept() : undefined
    if (fallback === undefined || fallback === null) throw error
    return fallback
  }
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

// JSON that keeps Dates (GameView and the start page carry some).
function encode(value: unknown): string {
  return JSON.stringify(value, function (key, plain: unknown) {
    const raw: unknown = (this as Record<string, unknown>)[key]
    return raw instanceof Date ? { $date: raw.toISOString() } : plain
  })
}

function decode<T>(text: string): T {
  return JSON.parse(text, (_key, value: unknown) =>
    value !== null &&
    typeof value === "object" &&
    "$date" in value &&
    Object.keys(value).length === 1
      ? new Date((value as { $date: string }).$date)
      : value
  ) as T
}

function read<T>(key: string): T | null {
  const text = storage()?.getItem(key)
  if (!text) return null
  try {
    return decode<T>(text)
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  const store = storage()
  try {
    store?.setItem(key, encode(value))
  } catch {
    // Storage full or blocked: rather nothing than an older state that
    // misses rounds the server already has.
    store?.removeItem(key)
  }
}

function keysOf(store: Storage, prefix: string) {
  const keys: Array<string> = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key?.startsWith(prefix)) keys.push(key)
  }
  return keys
}

const accountPrefix = (viewerId: string) => `${dataPrefix}${viewerId}:`

/** The Viewer of the last answer from the server, or null. */
export function rememberedViewer(): Viewer | null {
  return read<Viewer>(viewerKey)
}

/** Removes the Viewer and everything kept for the account. */
export function forgetAccount(viewerId: string) {
  const store = storage()
  if (!store) return
  for (const key of keysOf(store, accountPrefix(viewerId))) {
    store.removeItem(key)
  }
  if (rememberedViewer()?.id === viewerId) store.removeItem(viewerKey)
}

/** The query client of this page, once `keepQueriesOnDevice` ran. */
let client: QueryClient | null = null
/** Queries filled from the device when the page started. */
const filledFromDevice = new Set<string>()

/** Kept, or filled from the device (those carry no options yet). */
const isKept = (query: Query) =>
  query.meta?.keptOnDevice !== undefined ||
  filledFromDevice.has(query.queryHash)

/**
 * Remembers the Viewer the server answered with. When another account (or
 * none) answers, the previous account's data leaves the device and the
 * query cache; the queue of unsent steps stays (ADR 0007).
 */
export function rememberViewer(viewer: Viewer | null) {
  const before = rememberedViewer()
  if (before && before.id !== viewer?.id) {
    forgetAccount(before.id)
    client?.removeQueries({ predicate: isKept })
  }
  if (!viewer) return
  write(viewerKey, viewer)
  // Data the page came with from the server arrived before the Viewer was
  // known here.
  client?.getQueryCache().getAll().forEach(keep)
}

type Entry = {
  queryKey: QueryKey
  data: unknown
  updatedAt: number
  pinned: boolean
}

function keep(query: Query) {
  const kept = query.meta?.keptOnDevice
  const owner = rememberedViewer()
  const store = storage()
  if (!kept || !owner || !store || query.state.status !== "success") return
  const prefix = accountPrefix(owner.id)
  write(prefix + JSON.stringify(query.queryKey), {
    queryKey: query.queryKey,
    data: query.state.data,
    updatedAt: query.state.dataUpdatedAt,
    pinned: isPinned(kept, query.state.data),
  } satisfies Entry)
  dropOldest(store, prefix)
}

function dropOldest(store: Storage, prefix: string) {
  const unpinned = keysOf(store, prefix)
    .map((key) => ({ key, entry: read<Entry>(key) }))
    .filter(({ entry }) => !entry?.pinned)
    .sort((a, b) => (b.entry?.updatedAt ?? 0) - (a.entry?.updatedAt ?? 0))
  for (const { key } of unpinned.slice(maxUnpinned)) store.removeItem(key)
}

/**
 * Fills the query cache with what is kept for the remembered Viewer and
 * keeps every later answer of the marked queries. Called once in the browser.
 */
export function keepQueriesOnDevice(queryClient: QueryClient) {
  const store = storage()
  if (!store) return
  client = queryClient
  const viewer = rememberedViewer()
  if (viewer) {
    for (const key of keysOf(store, accountPrefix(viewer.id))) {
      const entry = read<Entry>(key)
      if (!entry) continue
      // With the time it was loaded, so it counts as stale and is loaded
      // again when there is a connection.
      queryClient.setQueryData(entry.queryKey, entry.data, {
        updatedAt: entry.updatedAt,
      })
      const query = queryClient.getQueryCache().find({
        queryKey: entry.queryKey,
        exact: true,
      })
      if (query) filledFromDevice.add(query.queryHash)
    }
  }

  queryClient.getQueryCache().subscribe((event) => {
    // Answers of the server, and data the page came with ("added" when the
    // server's data is hydrated into the cache).
    if (
      event.type === "added" ||
      (event.type === "updated" &&
        (event.action.type === "success" || event.action.type === "setState"))
    ) {
      keep(event.query)
    }
  })
}
