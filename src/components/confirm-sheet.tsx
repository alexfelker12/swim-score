import { useState } from "react"
import { BottomSheet } from "@/components/bottom-sheet"
import {
  destructiveButtonClass,
  largeSecondaryButtonClass,
} from "@/components/buttons"
import type { ReactNode } from "react"

/**
 * "Ben entfernen?" and the like: a coral confirm button over "Abbrechen".
 * `onConfirm` returns an error message to show, or nothing when it is done.
 */
export function ConfirmSheet({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: ReactNode
  description: ReactNode
  confirmLabel: string
  onConfirm: () => Promise<string | undefined>
  onClose: () => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setPending(true)
    setError(null)
    const failure = await onConfirm()
    if (failure === undefined) return
    setError(failure)
    setPending(false)
  }

  return (
    <BottomSheet title={title} description={description} onDismiss={onClose}>
      {error ? (
        <p role="alert" className="text-sm text-pretty text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className={destructiveButtonClass}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onClose}
          className={largeSecondaryButtonClass}
        >
          Abbrechen
        </button>
      </div>
    </BottomSheet>
  )
}
