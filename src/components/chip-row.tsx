import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/**
 * Chips side by side (`Toggle variant="chip"`), a row that scrolls sideways
 * without a scrollbar when it is wider than the screen; a reset action can
 * close it (the filters of a Group's Games). Name it with `aria-label`.
 *
 * ```tsx
 * <ChipRow aria-label="Spiele filtern" className="px-4 pb-3">
 *   <Toggle variant="chip" pressed={…}>Mit mir</Toggle>
 *   <Button variant="ghost" size="xs">Zurücksetzen</Button>
 * </ChipRow>
 * ```
 */
export function ChipRow({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="chip-row"
      role="group"
      className={cn(
        "flex [scrollbar-width:none] gap-2 overflow-x-auto *:shrink-0",
        className
      )}
      {...props}
    />
  )
}
