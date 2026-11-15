"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import type * as React from "react"

const radioGroupVariants = cva("grid w-full", {
  variants: {
    variant: {
      /** Radios or radio cards under each other. */
      default: "gap-3",
      /**
       * A setting with a few short options, looking like the segmented tabs
       * ("Darstellung": System / Hell / Dunkel). Options are `RadioSegment`s.
       */
      segmented: "auto-cols-fr grid-flow-col gap-1 rounded-[14px] bg-muted p-1",
    },
  },
  defaultVariants: { variant: "default" },
})

function RadioGroup({
  className,
  variant = "default",
  ...props
}: RadioGroupPrimitive.Props & VariantProps<typeof radioGroupVariants>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      data-variant={variant}
      className={cn(radioGroupVariants({ variant }), className)}
      {...props}
    />
  )
}

/**
 * One option of a `RadioGroup variant="segmented"`: 40 px, an optional icon
 * (16 px) before the label, the checked one as a card with 600, the others
 * `muted-foreground`.
 */
function RadioSegment({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-segment"
      className={cn(
        "flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] text-[15px] text-muted-foreground transition-[color,background-color,scale] duration-100 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100 data-checked:bg-card data-checked:font-semibold data-checked:text-foreground data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "group/radio-group-item peer relative flex aspect-square size-5.5 shrink-0 items-center justify-center rounded-full border-2 border-life-off outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive data-checked:border-primary",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex size-full items-center justify-center"
      >
        <span className="size-2.5 rounded-full bg-primary" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}

/**
 * One option of a single choice as a card ("Wer bist du?"): the radio on the
 * left, title and note on the right. Selected: `primary` border on
 * `primary-muted`.
 */
function RadioCard({
  className,
  children,
  ...props
}: RadioPrimitive.Root.Props) {
  return (
    <label
      data-slot="radio-card"
      className={cn(
        "flex min-h-15 cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] border-border bg-card px-4 py-2.5 transition-[background-color,border-color,scale] duration-100 active:scale-[0.98] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary has-data-checked:border-primary has-data-checked:bg-primary-muted has-data-disabled:opacity-40 motion-reduce:active:scale-100 [&_[data-slot=radio-group-item]]:focus-visible:outline-none",
        className
      )}
    >
      <RadioGroupItem {...props} />
      <span className="flex min-w-0 flex-col">{children}</span>
    </label>
  )
}

function RadioCardTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="radio-card-title"
      className={cn("truncate text-[17px] font-semibold", className)}
      {...props}
    />
  )
}

function RadioCardDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="radio-card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  RadioGroup,
  RadioGroupItem,
  RadioSegment,
  RadioCard,
  RadioCardTitle,
  RadioCardDescription,
}
