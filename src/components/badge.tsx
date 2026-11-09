import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

/** Pill badge: "Verwalter" in primary, "Gast" muted. */
export function Badge({
  tone,
  children,
}: {
  tone: "primary" | "muted"
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.25 py-0.75 text-[13px] font-medium",
        tone === "primary"
          ? "bg-primary-muted text-primary"
          : "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}
