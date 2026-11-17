import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Separator } from "@/components/ui/separator"

function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="list"
      data-slot="item-group"
      className={cn("group/item-group flex w-full flex-col gap-4", className)}
      {...props}
    />
  )
}

function ItemSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      className={cn("my-2", className)}
      {...props}
    />
  )
}

const itemVariants = cva(
  "group/item flex w-full flex-wrap items-center rounded-2xl border text-sm transition-colors duration-100 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [a]:transition-colors [a]:hover:bg-muted [a]:active:bg-muted [button]:hover:bg-muted [button]:active:bg-muted",
  {
    variants: {
      variant: {
        default: "border-transparent",
        /** List row: at least 56 px, 1 px divider at the bottom. */
        row: "min-h-14 rounded-none border-0 border-b border-border",
        /** A row as a card: 1.5 px border on `card`, radius 14 px. */
        card: "rounded-[14px] border-[1.5px] border-border bg-card",
      },
      size: {
        default: "gap-3.5 px-4 py-3.5",
        /** Rows in lists: no side padding, 6 px top and bottom. */
        list: "gap-3 px-0 py-1.5",
        /**
         * Lines of a menu in a sheet: 56 px, icon 22 px and text 17 px, no
         * side padding.
         */
        menu: "min-h-14 gap-3.5 px-0 py-0 text-[17px] [&_[data-slot=item-media]_svg]:size-5.5",
        /**
         * Rows to open something (a Group on the start page): at least 68 px,
         * title 17 px, description 15 px, a muted chevron in `ItemActions`.
         */
        lg: "min-h-17 gap-3 px-4 py-2.5 [&_[data-slot=item-actions]_svg]:size-5 [&_[data-slot=item-actions]_svg]:text-muted-foreground",
      },
      tone: {
        default: "",
        /** Something that removes or ends ("Spiel abbrechen"): in coral. */
        destructive: "text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      tone: "default",
    },
  }
)

function Item({
  className,
  variant = "default",
  size = "default",
  tone = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof itemVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(itemVariants({ variant, size, tone, className })),
      },
      props
    ),
    render,
    state: {
      slot: "item",
      variant,
      size,
    },
  })
}

const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function ItemMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn(
        "flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none",
        className
      )}
      {...props}
    />
  )
}

/**
 * 16 px / 600; in list rows (`size="list"`) 17 px / 500, in menus 17 px / 400,
 * in `size="lg"` 17 px / 600.
 */
function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn(
        "line-clamp-1 flex w-fit min-w-0 items-center gap-2 text-base leading-snug font-semibold underline-offset-4 group-data-[size=lg]/item:text-[17px] group-data-[size=list]/item:text-[17px] group-data-[size=list]/item:font-medium group-data-[size=menu]/item:text-[17px] group-data-[size=menu]/item:font-normal",
        className
      )}
      {...props}
    />
  )
}

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        "line-clamp-2 text-left text-[13px] font-normal text-muted-foreground group-data-[size=lg]/item:text-[15px] [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-actions"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  )
}

function ItemHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-header"
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className
      )}
      {...props}
    />
  )
}

function ItemFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-footer"
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className
      )}
      {...props}
    />
  )
}

/**
 * A row that is a button (a menu line): `<Item render={<ItemButton
 * onClick={…} />}>`. The look comes from `Item`.
 */
function ItemButton({ className, ...props }: ButtonPrimitive.Props) {
  return (
    <ButtonPrimitive
      data-slot="item-button"
      className={cn("cursor-pointer text-left", className)}
      {...props}
    />
  )
}

export {
  Item,
  ItemButton,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemFooter,
}
