import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/**
 * Chips side by side (`Toggle variant="chip"`) in `ChipRowChips`, a row that
 * scrolls sideways without a scrollbar when it is wider than the screen and
 * fades out at its edges, so a chip there doesn't end in a hard cut. An
 * action that must stay in reach however far the chips scrolled ("Filter
 * zurücksetzen") goes into `ChipRowAction`, fixed at the right outside the
 * scrolling. Name the row with `aria-label`.
 *
 * ```tsx
 * <ChipRow aria-label="Spiele filtern" className="pb-3">
 *   <ChipRowChips>
 *     <Toggle variant="chip" pressed={…}>Mit mir</Toggle>
 *   </ChipRowChips>
 *   <ChipRowAction>
 *     <Button variant="ghost" size="icon" aria-label="Filter zurücksetzen">
 *       <FilterX />
 *     </Button>
 *   </ChipRowAction>
 * </ChipRow>
 * ```
 */
export function ChipRow({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="chip-row"
      role="group"
      className={cn("flex items-center", className)}
      {...props}
    />
  )
}

/** The chips: 16 px from the screen's edge, scrolling, fading at both ends. */
export function ChipRowChips({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="chip-row-chips"
      className={cn(
        "flex min-w-0 flex-1 [scrollbar-width:none] gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%_-_1rem),transparent)] px-4 *:shrink-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * Next to the chips on the right, never scrolled away; a 44 px button in it
 * keeps the row at the chips' height.
 */
export function ChipRowAction({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="chip-row-action"
      className={cn("-my-1 -ml-2 shrink-0 pr-2", className)}
      {...props}
    />
  )
}
