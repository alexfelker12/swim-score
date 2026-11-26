import { CommandError } from "./errors"

// Lists come in pages (#59, ADR 0017): a page asks for `size` entries after
// a cursor, and the answer carries the cursor for the next page, or null at
// the end. The cursor holds the values the list is ordered by for the last
// entry handed out, not a position, so an entry added in between (a Game
// started) doesn't show twice or push others out of the list.

/** What the client asks for; without `after`, the first page. */
export type PageRequest = { size: number; after?: string | null }

/** One page of a list, and where the next one starts (null: the end). */
export type Page<T> = { items: Array<T>; next: string | null }

/** As many entries as fill a phone screen and a bit; lists may ask for more. */
export const DEFAULT_PAGE_SIZE = 15
export const MAX_PAGE_SIZE = 50

/** The values an entry is ordered by, as its cursor carries them. */
export type Key = Array<string | number | null>

/**
 * What each value of a list's cursor is; a cursor of another shape is not
 * one of this list's (`invalidPage`).
 */
export type KeyShape = Array<"string" | "number" | "number|null">

/** A sane request with its cursor read, or `invalidPage`. */
export function readPage(
  request: PageRequest = { size: DEFAULT_PAGE_SIZE },
  shape: KeyShape
) {
  const { size, after } = request
  if (!Number.isInteger(size) || size < 1 || size > MAX_PAGE_SIZE) {
    throw new CommandError("invalidPage")
  }
  return { size, after: after ? decode(after, shape) : null }
}

/**
 * The page from rows the database already ordered and started after the
 * cursor, fetched with one more than `size` to tell whether more follow.
 */
export function pageOfRows<T>(
  rows: Array<T>,
  size: number,
  keyOf: (row: T) => Key
): Page<T> {
  const items = rows.slice(0, size)
  const last = items.at(-1)
  return {
    items,
    next: rows.length > size && last ? encode(keyOf(last)) : null,
  }
}

/**
 * A page of a list the server orders itself (by names, by when a Group last
 * played): sorted by `compare` on the entries' keys, the entries after the
 * cursor's key.
 */
export function pageOfSorted<T>(
  list: Array<T>,
  request: PageRequest | undefined,
  order: {
    shape: KeyShape
    keyOf: (item: T) => Key
    compare: (a: Key, b: Key) => number
  }
): Page<T> {
  const { size, after } = readPage(request, order.shape)
  const { keyOf, compare } = order
  const sorted = [...list].sort((a, b) => compare(keyOf(a), keyOf(b)))
  const start =
    after === null
      ? 0
      : sorted.findIndex((item) => compare(keyOf(item), after) > 0)
  return pageOfRows(
    start === -1 ? [] : sorted.slice(start, start + size + 1),
    size,
    keyOf
  )
}

function encode(key: Key) {
  return Buffer.from(JSON.stringify(key)).toString("base64url")
}

function decode(cursor: string, shape: KeyShape): Key {
  let key: unknown
  try {
    key = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
  } catch {
    throw new CommandError("invalidPage")
  }
  const fits =
    Array.isArray(key) &&
    key.length === shape.length &&
    key.every((value: unknown, i) =>
      shape[i] === "string"
        ? typeof value === "string"
        : (shape[i] === "number|null" && value === null) ||
          (typeof value === "number" && Number.isFinite(value))
    )
  if (!fits) throw new CommandError("invalidPage")
  return key as Key
}
