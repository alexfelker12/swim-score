import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

const pageFooterVariants = cva("flex shrink-0 flex-col gap-2.5 px-4 pb-6", {
  variants: {
    variant: {
      /** The page's main actions at its end, without a frame. */
      default: "pt-4",
      /**
       * Stays at the bottom while the page scrolls, with a line on top;
       * above the page, also above a row being dragged.
       */
      sticky: "sticky bottom-0 z-20 border-t border-border bg-background pt-3",
      /** Under a scrolling area, with a line on top. */
      bordered: "border-t border-border pt-4",
    },
    align: {
      start: "",
      /** Notes under the actions centred. */
      center: "text-center",
    },
  },
  defaultVariants: { variant: "default", align: "start" },
})

/**
 * The actions at the foot of a page ("Neues Spiel", "Beitreten"), main
 * action first, under each other.
 */
export function PageFooter({
  className,
  variant = "default",
  align,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof pageFooterVariants>) {
  return (
    <div
      data-slot="page-footer"
      data-variant={variant}
      className={cn(pageFooterVariants({ variant, align }), className)}
      {...props}
    />
  )
}
