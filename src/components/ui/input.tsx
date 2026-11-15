import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

/**
 * Input from docs/design/README.md › Bausteine: 52 px, radius 12 px, 1.5 px
 * border (focus `primary`, error `destructive`) on `card`. Read-only values
 * (the username in the profile) show on `muted` without a border.
 * Shared with InputGroup and NativeSelect.
 */
export const inputSurfaceClass =
  "h-13 rounded-xl border-[1.5px] dark:scheme-dark border-border bg-card text-base transition-colors duration-200 outline-none focus-visible:border-primary aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-40"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        inputSurfaceClass,
        "w-full min-w-0 px-3.5 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground read-only:border-transparent read-only:bg-muted read-only:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Input }
