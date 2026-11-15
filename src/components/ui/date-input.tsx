import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { cn } from "cn"

import { Input } from "@/components/ui/input"

/**
 * Native date input with our own calendar icon. Browsers draw different
 * indicators (Samsung Internet a chevron, iOS none), so the native one is
 * made invisible and stretched over the whole field: a tap anywhere still
 * opens the native picker, and the Lucide icon below shows the same on
 * every device.
 *
 * Mobile engines draw the field like a select: `appearance-none` removes the
 * chevron Chrome on Android adds, and the value loses the 24 px right margin
 * Android keeps for that chevron (it cut off the year). The min height keeps
 * an empty field from collapsing on iOS.
 */
function DateInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <div
      data-slot="date-input-wrapper"
      className={cn("group/date-input relative w-full", className)}
    >
      <Input
        type="date"
        data-slot="date-input"
        className="relative appearance-none pr-11 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-date-and-time-value]:m-0 [&::-webkit-date-and-time-value]:min-h-[1.5em] [&::-webkit-date-and-time-value]:text-left"
        {...props}
      />
      <CalendarIcon
        aria-hidden="true"
        data-slot="date-input-icon"
        className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-muted-foreground group-has-[input:disabled]/date-input:opacity-40"
      />
    </div>
  )
}

export { DateInput }
