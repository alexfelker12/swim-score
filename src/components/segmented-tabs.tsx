import { cn } from "@/lib/utils"

/** Segmented control: muted track, the selected option as a card. */
export function SegmentedTabs<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "grid auto-cols-fr grid-flow-col gap-1 rounded-[14px] bg-muted p-1",
        className
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-10 rounded-[10px] text-[15px]",
              selected ? "bg-card font-semibold" : "text-muted-foreground"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
