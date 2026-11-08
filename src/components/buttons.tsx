import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/** Main action: 52–56 px, primary fill. */
export function PrimaryButton({
  className,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "flex h-14 shrink-0 items-center justify-center rounded-[14px] bg-primary px-4 text-base font-semibold text-primary-foreground disabled:opacity-40",
        className
      )}
      {...props}
    />
  )
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
