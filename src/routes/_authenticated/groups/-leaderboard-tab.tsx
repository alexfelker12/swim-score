import { Link } from "@tanstack/react-router"
import {
  MetricPicker,
  MetricPickerContent,
  MetricPickerTrigger,
} from "@/components/metric-picker"
import {
  PeriodPicker,
  PeriodPickerContent,
  PeriodPickerTrigger,
} from "@/components/period-picker"
import {
  RankingName,
  RankingNote,
  RankingPlace,
  RankingRow,
  RankingValue,
} from "@/components/ranking"
import { Section, SectionDescription, SectionTitle } from "@/components/section"
import { formatMetricValue } from "@/lib/metric-format"
import type {
  Leaderboard,
  MetricBoard,
  MetricId,
  MetricUnit,
  RankedPlayer,
} from "@/server/leaderboard"
import type { Period } from "@/server/stats"

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
  onMetricChange: (metricId: MetricId) => void
  onPeriodChange: (period: Period) => void
}) {
  if (!leaderboard || leaderboard.since === null) {
    return (
      <SectionDescription className="px-5 py-6">
        {leaderboard
          ? "Die Rangliste erscheint, sobald ihr ein Spiel beendet habt."
          : "Die Rangliste lässt sich gerade nicht laden."}
      </SectionDescription>
    )
  }
  const metric =
    leaderboard.metrics.find((m) => m.id === metricId) ?? leaderboard.metrics[0]
  return (
    <div className="flex flex-1 flex-col px-4 pb-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5">
        <MetricPicker
          metrics={leaderboard.metrics}
          value={metric.id}
          onValueChange={onMetricChange}
        >
          <MetricPickerTrigger />
          <MetricPickerContent />
        </MetricPicker>
        <PeriodPicker
          since={leaderboard.since}
          years={leaderboard.years}
          period={period}
          onPeriodChange={onPeriodChange}
        >
          <PeriodPickerTrigger />
          <PeriodPickerContent />
        </PeriodPicker>
      </div>
      <SectionDescription className="mx-1 mt-2 mb-1">
        {metric.description}
      </SectionDescription>

      <Ranking metric={metric} />
    </div>
  )
}

function Ranking({ metric }: { metric: MetricBoard }) {
  if (metric.ranked.length === 0 && metric.pending.length === 0) {
    return (
      <SectionDescription className="mx-1 py-4">
        In diesem Zeitraum wurde kein Spiel beendet.
      </SectionDescription>
    )
  }
  return (
    <>
      {metric.ranked.length === 0 ? (
        <SectionDescription className="mx-1 py-4">
          Noch niemand hat in diesem Zeitraum {metric.minGames} Spiele.
        </SectionDescription>
      ) : null}
      {metric.ranked.length > 0 ? (
        <ol aria-label={`Rangliste: ${metric.name}`}>
          {metric.ranked.map((row) => (
            <RankedRow key={row.playerId} row={row} unit={metric.unit} />
          ))}
        </ol>
      ) : null}
      {metric.pending.length > 0 ? (
        <Section aria-labelledby="leaderboard-pending" className="mt-5 gap-1">
          <SectionTitle
            id="leaderboard-pending"
            variant="muted"
            className="mx-1"
          >
            Noch nicht gewertet, unter {metric.minGames} Spielen
          </SectionTitle>
          <ul>
            {metric.pending.map((p) => (
              <RankingRow
                key={p.playerId}
                pending
                render={profileLink(p.userId)}
              >
                <RankingPlace />
                <RankingName guest={p.guest}>{p.name}</RankingName>
                <RankingNote>
                  {p.games} von {metric.minGames} Spielen
                </RankingNote>
              </RankingRow>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  )
}

/** With an account the row opens the Player Profile; a Guest's row is not tappable. */
function profileLink(userId: string | null) {
  return userId ? <Link to="/players/$userId" params={{ userId }} /> : undefined
}

function RankedRow({ row, unit }: { row: RankedPlayer; unit: MetricUnit }) {
  return (
    <RankingRow first={row.rank === 1} render={profileLink(row.userId)}>
      <RankingPlace>{row.rank}</RankingPlace>
      <RankingName guest={row.guest}>{row.name}</RankingName>
      <RankingValue detail={row.detail}>
        {formatMetricValue(row.value, unit)}
      </RankingValue>
    </RankingRow>
  )
}
