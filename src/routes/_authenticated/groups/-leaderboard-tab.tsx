import { useState } from "react"
import {
  Bomb,
  Calendar,
  Check,
  ChevronDown,
  Percent,
  Shield,
  Star,
  Trophy,
  Users,
  Waves,
} from "lucide-react"
import { BottomSheet } from "@/components/bottom-sheet"
import { Field, TextInput } from "@/components/form-field"
import {
  largeSecondaryButtonClass,
  primaryButtonClass,
} from "@/components/buttons"
import {
  formatDayRange,
  formatMonthYear,
  formatShortDayRange,
  todayKey,
  yearOf,
} from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import type {
  Leaderboard,
  MetricBoard,
  MetricId,
  MetricUnit,
  Period,
  RankedPlayer,
} from "@/server/leaderboard"

/** Each metric's icon, on the selector and in the metric sheet. */
const METRIC_ICONS: Record<MetricId, LucideIcon> = {
  wins: Trophy,
  winRate: Percent,
  games: Users,
  bombsPerGame: Bomb,
  swimRate: Waves,
  unbreakable: Shield,
  untouchable: Star,
}

function MetricIcon({ id, className }: { id: MetricId; className?: string }) {
  const Icon = METRIC_ICONS[id]
  return <Icon className={cn("size-5", className)} aria-hidden="true" />
}

const decimal = new Intl.NumberFormat("de", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatValue(value: number, unit: MetricUnit): string {
  switch (unit) {
    case "percent":
      return `${Math.round(value * 100)}\u00a0%`
    case "decimal":
      return decimal.format(value)
    case "count":
      return String(value)
  }
}

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
function periodLabel(period: Period, { short = false } = {}): string {
  const choice = choiceOf(period)
  if (choice.kind === "all") return "Gesamt"
  if (choice.kind === "year") return String(choice.year)
  const from = period.from ?? ""
  const to = period.to ?? ""
  return short ? formatShortDayRange(from, to) : formatDayRange(from, to)
}

/** Tab "Rangliste": metric and period above the ranking of the Group's Players. */
export function LeaderboardTab({
  leaderboard,
  metricId,
  period,
  onMetricChange,
  onPeriodChange,
}: {
  leaderboard: Leaderboard | null
  /** The chosen metric; the first one when unknown. */
  metricId: string | undefined
  period: Period
  onMetricChange: (metricId: string) => void
  onPeriodChange: (period: Period) => void
}) {
  const [sheet, setSheet] = useState<"metric" | "period" | null>(null)
  if (!leaderboard || leaderboard.since === null) {
    return (
      <div role="tabpanel" className="px-5 py-6 text-muted-foreground">
        {leaderboard
          ? "Die Rangliste erscheint, sobald ihr ein Spiel beendet habt."
          : "Die Rangliste lässt sich gerade nicht laden."}
      </div>
    )
  }
  const metric =
    leaderboard.metrics.find((m) => m.id === metricId) ?? leaderboard.metrics[0]
  return (
    <div role="tabpanel" className="flex flex-1 flex-col px-4 pb-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5">
        <button
          type="button"
          onClick={() => setSheet("metric")}
          aria-haspopup="dialog"
          className="flex h-11 min-w-0 items-center gap-2 rounded-xl border-[1.5px] border-primary bg-primary-muted px-3.5 text-base font-semibold text-primary"
        >
          <MetricIcon id={metric.id} className="shrink-0" />
          <span className="truncate">{metric.name}</span>
          <span className="sr-only">, Kennzahl ändern</span>
          <ChevronDown className="ml-auto size-5 shrink-0" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setSheet("period")}
          aria-haspopup="dialog"
          className="flex h-11 min-w-0 items-center gap-2 rounded-xl border-[1.5px] border-border px-3 text-base font-semibold"
        >
          <Calendar
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="truncate" aria-hidden="true">
            {periodLabel(period, { short: true })}
          </span>
          <span className="sr-only">{periodLabel(period)}</span>
          <span className="sr-only">, Zeitraum ändern</span>
          <ChevronDown
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
      </div>
      <p className="mx-1 mt-2 mb-1 text-[15px] text-muted-foreground">
        {metric.description}
      </p>

      <Ranking metric={metric} />

      {sheet === "metric" ? (
        <MetricSheet
          metrics={leaderboard.metrics}
          selected={metric.id}
          onSelect={(id) => {
            setSheet(null)
            onMetricChange(id)
          }}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
      {sheet === "period" ? (
        <PeriodSheet
          leaderboard={leaderboard}
          period={period}
          onApply={(next) => {
            setSheet(null)
            onPeriodChange(next)
          }}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
    </div>
  )
}

function Ranking({ metric }: { metric: MetricBoard }) {
  if (metric.ranked.length === 0 && metric.pending.length === 0) {
    return (
      <p className="mx-1 py-4 text-muted-foreground">
        In diesem Zeitraum wurde kein Spiel beendet.
      </p>
    )
  }
  return (
    <>
      {metric.ranked.length === 0 ? (
        <p className="mx-1 py-4 text-muted-foreground">
          Noch niemand hat in diesem Zeitraum {metric.minGames} Spiele.
        </p>
      ) : null}
      {metric.ranked.length > 0 ? (
        <ol aria-label={`Rangliste: ${metric.name}`}>
          {metric.ranked.map((row) => (
            <RankedRow key={row.playerId} row={row} unit={metric.unit} />
          ))}
        </ol>
      ) : null}
      {metric.pending.length > 0 ? (
        <section aria-labelledby="leaderboard-pending" className="mt-5">
          <h2
            id="leaderboard-pending"
            className="mx-1 mb-1 text-[15px] font-semibold text-muted-foreground"
          >
            Noch nicht gewertet, unter {metric.minGames} Spielen
          </h2>
          <ul>
            {metric.pending.map((p) => (
              <li
                key={p.playerId}
                className="grid min-h-13 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-border text-muted-foreground"
              >
                <span />
                <PlayerName name={p.name} guest={p.guest} />
                <span className="text-[15px] tabular-nums">
                  {p.games} von {metric.minGames} Spielen
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}

function RankedRow({ row, unit }: { row: RankedPlayer; unit: MetricUnit }) {
  const first = row.rank === 1
  return (
    <li className="grid min-h-[55px] grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-border py-2">
      <span
        className={cn(
          "text-center text-[17px] font-semibold tabular-nums",
          first ? "text-primary" : "text-muted-foreground"
        )}
      >
        <span className="sr-only">Platz </span>
        {row.rank}
      </span>
      <PlayerName name={row.name} guest={row.guest} strong={first} />
      <span className="flex flex-col items-end">
        <span
          className={cn(
            "text-lg leading-tight font-bold tabular-nums",
            first && "text-primary"
          )}
        >
          {formatValue(row.value, unit)}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {row.detail}
        </span>
      </span>
    </li>
  )
}

function PlayerName({
  name,
  guest,
  strong = false,
}: {
  name: string
  guest: boolean
  strong?: boolean
}) {
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span
        className={cn(
          "truncate text-[17px]",
          strong ? "font-semibold" : "font-medium"
        )}
      >
        {name}
      </span>
      {guest ? (
        <span className="shrink-0 text-sm text-muted-foreground">Gast</span>
      ) : null}
    </span>
  )
}

function MetricSheet({
  metrics,
  selected,
  onSelect,
  onDismiss,
}: {
  metrics: Array<MetricBoard>
  selected: MetricId
  onSelect: (id: MetricId) => void
  onDismiss: () => void
}) {
  return (
    <BottomSheet title="Kennzahl" onDismiss={onDismiss}>
      <div role="radiogroup" aria-label="Kennzahl" className="flex flex-col">
        {metrics.map((m) => {
          const on = m.id === selected
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(m.id)}
              className="flex min-h-14 items-center gap-3 border-b border-border py-1.5 text-left"
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
                  on ? "bg-primary-muted text-primary" : "bg-muted"
                )}
              >
                <MetricIcon id={m.id} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[17px] font-semibold">{m.name}</span>
                <span className="text-[15px] text-muted-foreground">
                  {m.description}
                </span>
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
    </BottomSheet>
  )
}

/** The option ticked in the period sheet: all Games, a year, or a custom range. */
type PeriodOption = "all" | number | "custom"

function PeriodSheet({
  leaderboard,
  period,
  onApply,
  onDismiss,
}: {
  leaderboard: Leaderboard
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
        note: leaderboard.since
          ? `Alle Spiele seit ${formatMonthYear(leaderboard.since)}`
          : "Alle Spiele",
      },
      ...leaderboard.years.map((year) => ({
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
  if (typeof draft === "number" && !leaderboard.years.includes(draft)) {
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
