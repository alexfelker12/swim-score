import { useState } from "react"

/**
 * Open while mounted, closing on its own; `onClose` runs once it has closed
 * so the caller can unmount it. Closing waits while something is pending.
 */
export function useSheet(onClose: () => void) {
  const [open, setOpen] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return {
    pending,
    error,
    /** Runs `action`; it returns an error to show, or nothing when it is done. */
    async run(action: () => Promise<string | undefined>) {
      setPending(true)
      setError(null)
      const failure = await action()
      setPending(false)
      if (failure === undefined) setOpen(false)
      else setError(failure)
    },
    drawer: {
      open,
      onOpenChange: (next: boolean) => {
        if (!pending) setOpen(next)
      },
      onOpenChangeComplete: (isOpen: boolean) => {
        if (!isOpen) onClose()
      },
    },
  }
}
