import { useId, useRef } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { useModal } from "@/lib/use-modal"
import type { ReactNode } from "react"

/**
 * A decision as a sheet from the bottom over a dimmed page. Escape and a tap
 * on the dimmed page call `onDismiss`.
 */
export function BottomSheet({
  title,
  description,
  centered = false,
  onDismiss,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  /** Heading and text centred (the Winner sheet); otherwise left-aligned. */
  centered?: boolean
  onDismiss: () => void
  children: ReactNode
}) {
  const sheet = useRef<HTMLDivElement>(null)
  const id = useId()
  useModal(sheet, onDismiss)
  return createPortal(
    <div
      ref={sheet}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-text` : undefined}
      className="fixed inset-0 z-50 mx-auto flex max-w-[500px] flex-col justify-end outline-none"
    >
      <div
        aria-hidden="true"
        onClick={onDismiss}
        className="absolute inset-0 bg-scrim"
      />
      <div className="relative flex flex-col gap-4 rounded-t-3xl border-t border-border bg-card px-5 pt-2.5 pb-6">
        <span
          aria-hidden="true"
          className="mx-auto h-1 w-10 rounded-full bg-border"
        />
        <div className={cn("flex flex-col gap-2", centered && "text-center")}>
          <h2
            id={`${id}-title`}
            className={cn(
              "text-[22px] leading-tight font-semibold",
              centered && "flex items-center justify-center gap-3"
            )}
          >
            {title}
          </h2>
          {description ? (
            <p
              id={`${id}-text`}
              className="text-base text-pretty text-muted-foreground"
            >
              {description}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
