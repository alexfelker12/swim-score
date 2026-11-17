import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * A card from docs/design/README.md › Bausteine: radius 14 px, 1.5 px
 * border on `card`. A card rendered as a link (`render={<Link … />}`) reacts
 * to `active:` like the other tappable parts.
 */
const cardVariants = cva(
  "group/card flex flex-col rounded-[14px] border-[1.5px] text-card-foreground transition-[background-color,scale] duration-100 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [a]:active:scale-[0.98] [a]:active:bg-muted motion-reduce:[a]:active:scale-100",
  {
    variants: {
      variant: {
        /** A plain card ("Carla gewinnt"). */
        default: "border-border bg-card",
        /** Something running or waiting for you (a running Game, an open Claim). */
        primary: "border-primary bg-card",
        /** Something that doesn't count (a cancelled Game): dashed, muted. */
        dashed: "border-dashed border-border text-muted-foreground",
        /** A note on the page ("So geht es weiter"): `muted` without border. */
        muted: "border-transparent bg-muted",
      },
      size: {
        /** Cards with a title, text and actions: 16 px inside, 12 px between. */
        default: "gap-3 p-4",
        /** Entries in a list (Games): 16 / 14 px inside, 4 px between. */
        sm: "gap-1 px-4 py-3.5",
        /** Metric tiles: 14 / 12 px inside, 2 px between. */
        xs: "gap-0.5 px-3.5 py-3",
        /** A running Game among several on the start page: 16 px inside, radius 18. */
        md: "gap-1 rounded-[18px] p-4",
        /** The page's focus (a running Game alone on the start page): 20 px inside, radius 18. */
        lg: "gap-1.5 rounded-[18px] p-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Card({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { className: cn(cardVariants({ variant, size }), className) },
      props
    ),
    render,
    state: { slot: "card", variant, size },
  })
}

/** Title and, with `CardAction`, something on the right of it. */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min items-start gap-1 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-action]:gap-x-3",
        className
      )}
      {...props}
    />
  )
}

/** A short label over the title, 14 px / 600 in the primary colour ("Offene Anfrage"). */
function CardLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-label"
      className={cn("text-sm font-semibold text-primary", className)}
      {...props}
    />
  )
}

const cardTitleVariants = cva("text-pretty wrap-break-word", {
  variants: {
    size: {
      /** 17 px / 600. */
      default: "text-[17px] leading-snug font-semibold",
      /** 22 px / 700 (a running Game among several). */
      lg: "text-[22px] leading-snug font-bold",
      /** 28 px / 700 (a running Game alone). */
      xl: "text-[28px] leading-tight font-bold",
    },
  },
  defaultVariants: { size: "default" },
})

function CardTitle({
  className,
  size = "default",
  as: Tag = "div",
  ...props
}: Omit<React.ComponentProps<"div">, "ref"> &
  VariantProps<typeof cardTitleVariants> & {
    /** `h2` where the card is a section of the page with its title as heading. */
    as?: "div" | "h2"
  }) {
  return (
    <Tag
      data-slot="card-title"
      className={cn(cardTitleVariants({ size }), className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn(
        "text-[15px] text-pretty text-muted-foreground [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1.5 [&_ol]:pl-5",
        className
      )}
      {...props}
    />
  )
}

/** Top right of the header (a date, a small action). */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  )
}

/** Actions side by side, sharing the width. */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2.5 *:flex-1", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardLabel,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
}
