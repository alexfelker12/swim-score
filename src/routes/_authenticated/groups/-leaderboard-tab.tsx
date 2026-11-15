import { useState } from "react"
import {
  Bomb,
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
import { PeriodButton, PeriodSheet } from "@/components/period-picker"
import { ProfileLink } from "@/components/profile-link"
import { formatMetricValue } from "@/lib/metric-format"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import type {
  Leaderboard,
  MetricBoard,
  MetricId,
  MetricUnit,
  RankedPlayer,
} from "@/server/leaderboard"
import type { Period } from "@/server/stats"

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
        <PeriodButton period={period} onClick={() => setSheet("period")} />
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
          since={leaderboard.since}
          years={leaderboard.years}
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
              <li key={p.playerId} className="border-b border-border">
                <ProfileLink
                  userId={p.userId}
                  className="grid min-h-13 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-2 text-muted-foreground"
                >
                  <span />
                  <PlayerName name={p.name} guest={p.guest} />
                  <span className="text-[15px] tabular-nums">
                    {p.games} von {metric.minGames} Spielen
                  </span>
                </ProfileLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}

/** A ranked player; with an account, the row opens their Player Profile. */
function RankedRow({ row, unit }: { row: RankedPlayer; unit: MetricUnit }) {
  const first = row.rank === 1
  const className =
    "grid min-h-[55px] grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-2 py-2"
  return (
    <li className="border-b border-border">
      <ProfileLink userId={row.userId} className={className}>
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
            {formatMetricValue(row.value, unit)}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {row.detail}
          </span>
        </span>
      </ProfileLink>
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
