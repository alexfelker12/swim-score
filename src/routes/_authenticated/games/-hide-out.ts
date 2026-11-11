import { useEffect, useState } from "react"

const STORAGE_KEY = "swim-score:hide-out"

/**
 * "Ausgeschiedene ausblenden": whether the Game screen leaves out the rows of
 * Participants who are Out. Kept per device; the server render always shows
 * them, and the device's choice applies once the page runs.
 */
export function useHideOut(): [boolean, (hide: boolean) => void] {
  const [hideOut, setHideOut] = useState(false)
  useEffect(() => {
    try {
      setHideOut(window.localStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      // Storage can be unavailable (private mode); then nothing is hidden.
    }
  }, [])
  function change(hide: boolean) {
    setHideOut(hide)
    try {
      if (hide) window.localStorage.setItem(STORAGE_KEY, "1")
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Not kept for next time; the choice still applies now.
    }
  }
  return [hideOut, change]
}
