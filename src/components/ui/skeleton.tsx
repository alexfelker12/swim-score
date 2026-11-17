import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const skeletonVariants = cva("animate-pulse", {
  variants: {
    variant: {
      /** A block (a button, a card without content): `muted`, radius 14 px. */
      block: "rounded-[14px] bg-muted",
      /** A line of text: `muted`, round ends. */
      line: "rounded-full bg-muted",
      /** A card in `card` that holds lines and blocks; does not pulse itself. */
      card: "animate-none rounded-[14px] bg-card",
    },
  },
  defaultVariants: { variant: "block" },
})

/** A quiet placeholder while something loads. */
function Skeleton({
  className,
  variant = "block",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>) {
  return (
    <div
      data-slot="skeleton"
      data-variant={variant}
      className={cn(skeletonVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Skeleton, skeletonVariants }
