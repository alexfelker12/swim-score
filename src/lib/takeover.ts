// Taking over as Scorekeeper (ADR 0003), the same rules on server and screen.

/**
 * How long a Scorekeeper may be offline before anyone can take over: long
 * enough for a dead zone at the bar, short enough not to stall the Game.
 */
export const TAKEOVER_GRACE_MS = 2 * 60_000

/** From when on a Scorekeeper offline since `since` can be replaced. */
export function takeoverOpensAt(since: Date): Date {
  return new Date(since.getTime() + TAKEOVER_GRACE_MS)
}

/** "0:40" below 2 minutes, then "4 Min." and "2 Std.": how long someone is offline. */
export function formatOfflineFor(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 2) return formatCountdown(ms)
  if (minutes < 60) return `${minutes} Min.`
  return `${Math.floor(minutes / 60)} Std.`
}

/** "4 Minuten", "1 Stunde": the same in a sentence. */
export function formatOfflineForLong(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60_000))
  if (minutes < 60) return minutes === 1 ? "1 Minute" : `${minutes} Minuten`
  const hours = Math.floor(minutes / 60)
  return hours === 1 ? "1 Stunde" : `${hours} Stunden`
}

/** "1:20": minutes and seconds, for counting down. */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}
