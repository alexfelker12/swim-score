import { cn } from "@/lib/utils"

/** One option of a single choice: a radio button that looks like a card. */
export function ChoiceCard({
  name,
  value,
  selected,
  onSelect,
  label,
  note,
}: {
  /** Shared by the options of one choice. */
  name: string
  value: string
  /** The value currently chosen, if any. */
  selected: string | null
  onSelect: (value: string) => void
  label: string
  note: string
}) {
  return (
    <label
      className={cn(
        "flex min-h-15 items-center gap-3 rounded-[14px] border-[1.5px] px-4 py-2.5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
        value === selected
          ? "border-primary bg-primary-muted"
          : "border-border bg-card"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={value === selected}
        onChange={() => onSelect(value)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="flex size-5.5 shrink-0 items-center justify-center rounded-full border-2 border-life-off peer-checked:border-primary peer-checked:*:bg-primary"
      >
        <span className="size-2.5 rounded-full" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[17px] font-semibold">{label}</span>
        <span className="text-sm text-muted-foreground">{note}</span>
      </span>
    </label>
  )
}
