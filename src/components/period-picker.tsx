import { useState } from "react"
import { Calendar, Check, ChevronDown } from "lucide-react"
import { BottomSheet } from "@/components/bottom-sheet"
import {
  largeSecondaryButtonClass,
  primaryButtonClass,
} from "@/components/buttons"
import { Field, TextInput } from "@/components/form-field"
import {
  formatDayRange,
  formatMonthYear,
  formatShortDayRange,
  todayKey,
  yearOf,
} from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { Period } from "@/server/stats"

// The Period of a statistic (Group Leaderboard, Personal Stats): the button
// that shows it and the sheet that changes it.

/** A whole calendar year as a period, e.g. 2025. */
function yearPeriod(year: number): Required<Period> {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

/** Which option of the period sheet a period is. */
type PeriodChoice =
  { kind: "all" } | { kind: "year"; year: number } | { kind: "custom" }

function choiceOf(period: Period): PeriodChoice {
  if (!period.from || !period.to) return { kind: "all" }
  const year = Number(period.from.slice(0, 4))
  const whole = yearPeriod(year)
  return whole.from === period.from && whole.to === period.to
    ? { kind: "year", year }
    : { kind: "custom" }
}

/**
 * "Gesamt", "2025" or "1. März bis 30. Juni 2026"; `short` gives the custom
 * period as "1.3.–30.6.2026", which fits beside the metric on the button.
 */
export function periodLabel(period: Period, { short = false } = {}): string {
  const choice = choiceOf(period)
  if (choice.kind === "all") return "Gesamt"
  if (choice.kind === "year") return String(choice.year)
  const from = period.from ?? ""
  const to = period.to ?? ""
  return short ? formatShortDayRange(from, to) : formatDayRange(from, to)
}

/** The button that shows the Period and opens its sheet. */
export function PeriodButton({
  period,
  onClick,
  className,
}: {
  period: Period
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={cn(
        "flex h-11 min-w-0 items-center gap-2 rounded-xl border-[1.5px] border-border px-3 text-base font-semibold",
        className
      )}
    >
      <Calendar
        className="size-5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="truncate" aria-hidden="true">
        {periodLabel(period, { short: true })}
      </span>
      <span className="sr-only">{periodLabel(period)}, Zeitraum ändern</span>
      <ChevronDown
        className="size-5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </button>
  )
}

/** The option ticked in the period sheet: all Games, a year, or a custom range. */
type PeriodOption = "all" | number | "custom"

/**
 * Sheet "Zeitraum": all Games (since the first one), the years with Games,
 * or a custom range with native date fields. Applies only on "Übernehmen".
 */
export function PeriodSheet({
  since,
  years,
  period,
  onApply,
  onDismiss,
}: {
  /** When the first counted Game started; null before one. */
  since: Date | null
  /** Years with counted Games, newest first. */
  years: Array<number>
  period: Period
  onApply: (period: Period) => void
  onDismiss: () => void
}) {
  const current = choiceOf(period)
  const [draft, setDraft] = useState<PeriodOption>(
    current.kind === "year" ? current.year : current.kind
  )
  const thisYear = yearOf(new Date())
  const [from, setFrom] = useState(period.from ?? `${thisYear}-01-01`)
  const [to, setTo] = useState(period.to ?? todayKey())
  const customValid = from !== "" && to !== "" && from <= to

  const options: Array<{ value: PeriodOption; label: string; note?: string }> =
    [
      {
        value: "all",
        label: "Gesamt",
        note: since
          ? `Alle Spiele seit ${formatMonthYear(since)}`
          : "Alle Spiele",
      },
      ...years.map((year) => ({
        value: year,
        label: String(year),
        note: year === thisYear ? "Dieses Jahr" : undefined,
      })),
      {
        value: "custom",
        label: "Eigener Zeitraum",
        note: "Von und bis selbst wählen",
      },
    ]
  // A year chosen before that no longer has Games stays selectable.
  if (typeof draft === "number" && !years.includes(draft)) {
    options.splice(1, 0, { value: draft, label: String(draft) })
  }

  function apply() {
    if (draft === "all") onApply({})
    else if (draft === "custom") onApply({ from, to })
    else onApply(yearPeriod(draft))
  }

  return (
    <BottomSheet title="Zeitraum" onDismiss={onDismiss}>
      <div
        role="radiogroup"
        aria-label="Zeitraum"
        className="-mt-1 flex max-h-[50svh] flex-col overflow-y-auto"
      >
        {options.map((option) => {
          const on = option.value === draft
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setDraft(option.value)}
              className="flex min-h-13 items-center gap-3 border-b border-border px-1 py-1.5 text-left"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn("text-[17px]", on && "font-semibold")}>
                  {option.label}
                </span>
                {option.note ? (
                  <span className="text-[15px] text-muted-foreground">
                    {option.note}
                  </span>
                ) : null}
              </span>
              {on ? (
                <Check
                  className="mr-2 size-5.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          )
        })}
      </div>
      {draft === "custom" ? (
        <div className="grid grid-cols-2 gap-3">
          <DateField
            label="Von"
            value={from}
            max={to || undefined}
            onChange={setFrom}
          />
          <DateField
            label="Bis"
            value={to}
            min={from || undefined}
            onChange={setTo}
          />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onDismiss}
          className={largeSecondaryButtonClass}
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={draft === "custom" && !customValid}
          className={primaryButtonClass}
        >
          Übernehmen
        </button>
      </div>
    </BottomSheet>
  )
}

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: string
  min?: string
  max?: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      {(props) => (
        <TextInput
          {...props}
          type="date"
          value={value}
          min={min}
          max={max}
          required
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 px-3 dark:[color-scheme:dark]"
        />
      )}
    </Field>
  )
}
