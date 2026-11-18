import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

const pageVariants = cva("flex flex-col", {
  variants: {
    height: {
      /** At least the screen, growing with the content; the page scrolls. */
      content: "min-h-app",
      /** Exactly the screen; only parts inside scroll (the Game view). */
      screen: "h-app",
    },
  },
  defaultVariants: { height: "content" },
})

/**
 * A whole page, as high as the screen without the system's bars (ADR 0015),
 * with `PageHeader`, the content and `PageFooter` under each other.
 */
export function Page({
  className,
  height = "content",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof pageVariants>) {
  return (
    <div
      data-slot="page"
      data-height={height}
      className={cn(pageVariants({ height }), className)}
      {...props}
    />
  )
}
