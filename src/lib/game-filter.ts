import type { GameFilter } from "@/server/games"

// The filters of a Group's Games (#60) in one place: which there are, how
// they read, and how they sit in the page's search (`?mine=true&won=true`).

/** Every filter, in the order of its chip. */
export const GAME_FILTERS = [
  { key: "mine", label: "Mit mir" },
  { key: "swam", label: "Ich war Schwimmer" },
  { key: "won", label: "Ich habe gewonnen" },
  { key: "hideCancelled", label: "Ohne abgebrochene" },
] as const satisfies ReadonlyArray<{ key: keyof GameFilter; label: string }>

/**
 * Only the filters set, always in the same order, so the same filter is the
 * same query and the same search; from a filter or a page's search params.
 */
export function gameFilterOf(source: Record<string, unknown>): GameFilter {
  return Object.fromEntries(
    GAME_FILTERS.filter(({ key }) => source[key] === true).map(({ key }) => [
      key,
      true,
    ])
  )
}

/** A page's search params without the filters. */
export function withoutGameFilter<T extends Record<string, unknown>>(
  search: T
): Omit<T, keyof GameFilter> {
  const rest: Record<string, unknown> = { ...search }
  for (const { key } of GAME_FILTERS) delete rest[key]
  return rest as Omit<T, keyof GameFilter>
}

/** Whether any filter is set. */
export function hasGameFilter(filter: GameFilter): boolean {
  return GAME_FILTERS.some(({ key }) => filter[key] === true)
}

/** The filters set, as the chips read: "Mit mir, Ohne abgebrochene". */
export function describeGameFilter(filter: GameFilter): string {
  return GAME_FILTERS.filter(({ key }) => filter[key] === true)
    .map(({ label }) => label)
    .join(", ")
}
