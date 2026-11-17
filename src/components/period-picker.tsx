import { createContext, useContext, useState } from "react"
import { Calendar, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DateInput } from "@/components/ui/date-input"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  RadioGroup,
  RadioRow,
  RadioRowContent,
  RadioRowDescription,
  RadioRowIndicator,
  RadioRowTitle,
} from "@/components/ui/radio-group"
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
//
//   <PeriodPicker since={…} years={…} period={…} onPeriodChange={…}>
//     <PeriodPickerTrigger />
//     <PeriodPickerContent />
//   </PeriodPicker>

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

type PeriodPickerContext = {
  since: Date | null
  years: Array<number>
  period: Period
  apply: (period: Period) => void
}

const Context = createContext<PeriodPickerContext | null>(null)

function usePeriodPicker() {
  const context = useContext(Context)
  if (!context) throw new Error("Use inside <PeriodPicker>.")
  return context
}

/** Holds the Period and the sheet's open state for its trigger and content. */
export function PeriodPicker({
  since,
  years,
  period,
  onPeriodChange,
  children,
}: {
  /** When the first counted Game started; null before one. */
  since: Date | null
  /** Years with counted Games, newest first. */
  years: Array<number>
  period: Period
  onPeriodChange: (period: Period) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Context.Provider
      value={{
        since,
        years,
        period,
        apply: (next) => {
          setOpen(false)
          onPeriodChange(next)
        },
      }}
    >
      <Drawer open={open} onOpenChange={setOpen}>
        {children}
      </Drawer>
    </Context.Provider>
  )
}

/** The button that shows the Period ("Gesamt", "2025", "1.3.–30.6.2026") and opens the sheet. */
export function PeriodPickerTrigger({ className }: { className?: string }) {
  const { period } = usePeriodPicker()
  return (
    <DrawerTrigger
      render={
        <Button
          variant="picker"
          size="sm"
          className={cn("min-w-0 px-3 justify-start", className)}
        />
      }
    >
      <Calendar />
      <span className="truncate" aria-hidden="true">
        {periodLabel(period, { short: true })}
      </span>
      <span className="sr-only">{periodLabel(period)}, Zeitraum ändern</span>
      <ChevronDown className="ml-auto" aria-hidden="true" />
    </DrawerTrigger>
  )
}

/** The option ticked in the period sheet: all Games, a year, or a custom range. */
type PeriodOption = "all" | number | "custom"

/**
 * Sheet "Zeitraum": all Games (since the first one), the years with Games,
 * or a custom range with native date fields. Applies only on "Übernehmen".
 */
export function PeriodPickerContent() {
  return (
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Zeitraum</DrawerTitle>
      </DrawerHeader>
      <PeriodChoice />
    </DrawerContent>
  )
}

/** The choice itself; mounts with the sheet, so it starts from the applied Period. */
function PeriodChoice() {
  const { since, years, period, apply } = usePeriodPicker()
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

  return (
    <>
      <RadioGroup
        variant="list"
        aria-label="Zeitraum"
        // Many years scroll on their own, so the actions stay in view.
        className="max-h-[50svh] overflow-y-auto"
        value={draft}
        onValueChange={(value) => setDraft(value as PeriodOption)}
      >
        {options.map((option) => (
          <RadioRow key={String(option.value)} value={option.value}>
            <RadioRowContent>
              <RadioRowTitle>{option.label}</RadioRowTitle>
              {option.note ? (
                <RadioRowDescription>{option.note}</RadioRowDescription>
              ) : null}
            </RadioRowContent>
            <RadioRowIndicator />
          </RadioRow>
        ))}
      </RadioGroup>
      {draft === "custom" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="period-from">Von</FieldLabel>
            <DateInput
              id="period-from"
              value={from}
              max={to || undefined}
              required
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="period-to">Bis</FieldLabel>
            <DateInput
              id="period-to"
              value={to}
              min={from || undefined}
              required
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
        </div>
      ) : null}
      <DrawerFooter orientation="horizontal">
        <DrawerClose render={<Button variant="secondary" size="xl" />}>
          Abbrechen
        </DrawerClose>
        <Button
          size="xl"
          disabled={draft === "custom" && !customValid}
          onClick={() => {
            if (draft === "all") apply({})
            else if (draft === "custom") apply({ from, to })
            else apply(yearPeriod(draft))
          }}
        >
          Übernehmen
        </Button>
      </DrawerFooter>
    </>
  )
}
