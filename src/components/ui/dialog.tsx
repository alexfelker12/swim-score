import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-scrim transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className
      )}
      {...props}
    />
  )
}

// Open and close are CSS transitions on Base UI's starting/ending styles, with
// the same duration for backdrop and popup. (Keyframe animations of different
// lengths let the backdrop snap back for a frame before it unmounts.)
const dialogContentVariants = cva(
  "group/dialog-content fixed z-50 text-popover-foreground transition-[opacity,scale] duration-150 outline-none data-ending-style:opacity-0 data-starting-style:opacity-0",
  {
    variants: {
      variant: {
        default:
          "top-1/2 left-1/2 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-3xl bg-popover p-6 text-base shadow-xl ring-1 ring-foreground/5 data-ending-style:scale-95 data-starting-style:scale-95 sm:max-w-md dark:ring-foreground/10",
        /**
         * Full-screen dialog (only the profile picture editor): header 56 px
         * with a centred title, footer with a top border and two buttons side
         * by side.
         */
        fullscreen:
          "inset-0 mx-auto flex max-w-[500px] flex-col bg-background text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function DialogContent({
  className,
  children,
  variant = "default",
  showCloseButton = variant === "default",
  ...props
}: DialogPrimitive.Popup.Props &
  VariantProps<typeof dialogContentVariants> & {
    showCloseButton?: boolean
  }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-variant={variant}
        className={cn(dialogContentVariants({ variant }), className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3"
                size="icon"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Schließen</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-1.5",
        "group-data-[variant=fullscreen]/dialog-content:relative group-data-[variant=fullscreen]/dialog-content:h-14 group-data-[variant=fullscreen]/dialog-content:shrink-0 group-data-[variant=fullscreen]/dialog-content:flex-row group-data-[variant=fullscreen]/dialog-content:items-center group-data-[variant=fullscreen]/dialog-content:justify-center group-data-[variant=fullscreen]/dialog-content:px-2",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        "group-data-[variant=fullscreen]/dialog-content:mt-auto group-data-[variant=fullscreen]/dialog-content:flex-row group-data-[variant=fullscreen]/dialog-content:gap-2.5 group-data-[variant=fullscreen]/dialog-content:border-t group-data-[variant=fullscreen]/dialog-content:border-border group-data-[variant=fullscreen]/dialog-content:px-4 group-data-[variant=fullscreen]/dialog-content:pt-3 group-data-[variant=fullscreen]/dialog-content:pb-6 group-data-[variant=fullscreen]/dialog-content:*:flex-1",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="secondary" />}>
          Schließen
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-[22px] leading-tight font-semibold group-data-[variant=fullscreen]/dialog-content:text-[17px]",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-base text-pretty text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  dialogContentVariants,
}
