import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/** Main action: 52–56 px, primary fill. Also for links that look like it. */
export const primaryButtonClass =
  "flex h-14 shrink-0 items-center justify-center gap-2 rounded-[14px] bg-primary px-4 text-base font-semibold text-primary-foreground disabled:opacity-40"

/** A main action that removes or deletes something: coral fill. */
export const destructiveButtonClass =
  "flex h-14 shrink-0 items-center justify-center gap-2 rounded-[14px] bg-destructive px-4 text-base font-semibold text-destructive-foreground disabled:opacity-40"

/** Secondary action at full size (56 px), e.g. "Zur Gruppe". */
export const largeSecondaryButtonClass =
  "flex h-14 shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-border px-4 text-base font-medium disabled:opacity-40"

export function PrimaryButton({
  className,
  ...props
}: ComponentProps<"button">) {
  return <button className={cn(primaryButtonClass, className)} {...props} />
}

/** Secondary action: 1.5 px border, no fill. */
export function SecondaryButton({
  className,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "flex h-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-border bg-card px-4 text-[15px] font-medium disabled:opacity-40",
        className
      )}
      {...props}
    />
  )
}
