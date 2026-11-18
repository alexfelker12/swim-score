import { useEffect } from "react"

/**
 * Keeps the screen on while `active` (#56): counting at the table, the
 * phone lies there and must not go dark between rounds. The browser lets
 * go of the lock whenever the page is hidden, so it is taken again when the
 * page comes back. Where the browser has no Wake Lock, or refuses (low
 * battery), nothing happens.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return
    let lock: WakeLockSentinel | null = null
    /** A request on its way: no second one, or the first would be lost. */
    let requesting = false
    let stopped = false
    const take = async () => {
      if (requesting || document.visibilityState !== "visible") return
      requesting = true
      try {
        const next = await navigator.wakeLock.request("screen")
        if (stopped) void next.release()
        else lock = next
      } catch {
        // Refused: the screen goes dark as usual.
      } finally {
        requesting = false
      }
    }
    const onVisible = () => {
      if (!lock || lock.released) void take()
    }
    void take()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      stopped = true
      document.removeEventListener("visibilitychange", onVisible)
      void lock?.release().catch(() => undefined)
    }
  }, [active])
}
