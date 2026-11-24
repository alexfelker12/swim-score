import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-[14px] p-4 text-left text-[17px] text-pretty has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3.5 *:[svg]:row-span-2 *:[svg]:mt-0.5 *:[svg:not([class*='size-'])]:size-5.5",
  {
    variants: {
      variant: {
        /** A quiet message ("Link unterwegs", "Passwort gespeichert"), icon in `primary`. */
        default: "bg-muted text-foreground *:[svg]:text-primary",
        /** A quiet tip beside the content ("Am Tisch geht es am schnellsten …"): 15 px, all muted. */
        note: "bg-muted text-[15px] text-muted-foreground *:[svg]:text-muted-foreground",
        /** Floating above the page ("Neue Version verfügbar"), icon in `primary`. */
        floating:
          "bg-popover text-popover-foreground shadow-lg ring-1 ring-border *:[svg]:text-primary",
        /** Something went wrong. */
        destructive:
          "bg-destructive-muted text-destructive *:data-[slot=alert-description]:text-destructive *:[svg]:text-current",
      },
      size: {
        default: "",
        /**
         * One title and a short line, 15/13 px, one or two actions centred on
         * the right (the install hint at the bottom of the start page).
         */
        compact:
          "items-center py-3 pl-3.5 text-[15px] has-data-[slot=alert-action]:pr-14 has-[[data-slot=alert-action]>:nth-child(2)]:pr-42 has-[>svg]:gap-x-3 *:data-[slot=alert-description]:text-[13px] *:data-[slot=alert-description]:text-muted-foreground *:[svg]:mt-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/** Quiet messages are announced politely (`status`), errors at once (`alert`). */
function Alert({
  className,
  variant,
  size = "default",
  role = variant === "destructive" ? "alert" : "status",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-size={size}
      role={role}
      className={cn(alertVariants({ variant, size }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        "absolute top-2.5 right-3 flex items-center gap-1 group-data-[size=compact]/alert:top-1/2 group-data-[size=compact]/alert:right-1.5 group-data-[size=compact]/alert:-translate-y-1/2",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
