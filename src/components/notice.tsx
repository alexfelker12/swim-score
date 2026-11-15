import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

/**
 * A quiet message in a box with an icon in the primary colour, announced to
 * screen readers: "Link unterwegs", "Passwort gespeichert".
 */
export function Notice({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <p
      role="status"
      className="flex gap-3.5 rounded-[14px] bg-muted p-4 text-[17px] text-pretty"
    >
      <Icon
        className="mt-0.5 size-5.5 shrink-0 text-primary"
        aria-hidden="true"
      />
      <span>{children}</span>
    </p>
  )
}
