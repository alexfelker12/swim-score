// Whether steps of a Game wait on this device to be sent (ADR 0007), for
// parts of the app outside the Game page: the app must not reload itself
// for an update then (ADR 0011). The queues report here; steps from before a
// reload or from another tab are found in storage.

/** Start of the storage keys of the queues: `<prefix><viewer>:<game>`. */
export const waitingStepsPrefix = "swim-score:steps:"

/** Queues of this page with steps, also when storage failed. */
const waitingHere = new Set<string>()
const listeners = new Set<() => void>()

/** Called by a queue after its steps changed (and were stored). */
export function reportWaitingSteps(key: string, waiting: boolean) {
  if (waiting) waitingHere.add(key)
  else waitingHere.delete(key)
  listeners.forEach((listener) => listener())
}

export function hasWaitingSteps(): boolean {
  if (waitingHere.size > 0) return true
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith(waitingStepsPrefix)) return true
    }
  } catch {
    // Without storage only this page's queues are known.
  }
  return false
}

/** Calls `listener` when waiting steps change, here or in another tab. */
export function subscribeWaitingSteps(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}
