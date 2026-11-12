import { useEffect, useMemo, useState } from "react"

/**
 * The server's current time, from `serverTime` (its clock when the data was
 * loaded) and this device's clock since then, so countdowns agree across
 * devices whose clocks differ. Updates every second while `ticking`.
 */
export function useServerNow(serverTime: Date, ticking: boolean): Date {
  const loadedAt = serverTime.getTime()
  // Taken anew with every load, so data from the cache is corrected by the
  // next one.
  const offset = useMemo(() => loadedAt - Date.now(), [loadedAt])
  const [, tick] = useState(0)
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [ticking])
  return new Date(Date.now() + offset)
}
