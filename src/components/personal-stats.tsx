import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"
import { PeriodButton, PeriodSheet } from "@/components/period-picker"
import { formatMetricValue } from "@/lib/metric-format"
import type { PlayerProfile } from "@/server/player-profile"
import type { Period } from "@/server/stats"

/**
 * Personal Stats: "Über alle Gruppen" with the Period and one tile per
 * metric, then a card per Group that links to its Leaderboard (only shared
 * Groups on someone else's profile).
 */
export function PersonalStats({
  profile,
  period,
  onPeriodChange,
}: {
  profile: PlayerProfile
  period: Period
  onPeriodChange: (period: Period) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const groupsId = `groups-${profile.userId}`
  return (
    <div className="flex flex-col px-4 pb-8">
      <div className="flex items-center justify-between gap-3 py-2 pl-1">
        <h2 className="text-[17px] font-semibold">Über alle Gruppen</h2>
        <PeriodButton period={period} onClick={() => setChoosing(true)} />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2.5">
        {profile.totals.map((metric) => (
          <div
            key={metric.id}
            className="flex flex-col-reverse gap-0.5 rounded-[14px] border-[1.5px] border-border bg-card px-3.5 py-3"
          >
            <dt className="text-[15px] text-muted-foreground">{metric.name}</dt>
            <dd className="text-[26px] leading-tight font-bold tabular-nums">
              {formatMetricValue(metric.value, metric.unit)}
            </dd>
          </div>
        ))}
      </dl>

      {profile.groups.length > 0 ? (
        <section aria-labelledby={groupsId} className="mt-7 flex flex-col">
          <h2 id={groupsId} className="mb-3 pl-1 text-[17px] font-semibold">
            {profile.isMe ? "Nach Gruppe" : "In euren gemeinsamen Gruppen"}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {profile.groups.map((group) => (
              <li key={group.groupId}>
                <Link
                  to="/groups/$groupId"
                  params={{ groupId: group.groupId }}
                  search={{ tab: "leaderboard", ...period }}
                  className="flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-border bg-card px-4 py-3.5"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-[17px] font-semibold">
                      {group.name}
                    </span>
                    <span className="flex shrink-0 items-center text-[15px] font-medium text-primary">
                      Rangliste
                      <ChevronRight className="size-5" aria-hidden="true" />
                    </span>
                  </span>
                  <span className="grid grid-cols-3">
                    <GroupFigure
                      value={String(group.games)}
                      label={group.games === 1 ? "Spiel" : "Spiele"}
                    />
                    <GroupFigure
                      value={String(group.wins)}
                      label={group.wins === 1 ? "Sieg" : "Siege"}
                    />
                    <GroupFigure
                      value={formatMetricValue(group.winRate, "percent")}
                      label="Winrate"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {profile.isMe ? null : (
            <p className="mt-3 px-1 text-[15px] text-pretty text-muted-foreground">
              Hier stehen nur Gruppen, die ihr beide teilt. Die Werte oben
              zählen alle Spiele von {profile.name}.
            </p>
          )}
        </section>
      ) : null}

      {choosing ? (
        <PeriodSheet
          since={profile.since}
          years={profile.years}
          period={period}
          onApply={(next) => {
            setChoosing(false)
            onPeriodChange(next)
          }}
          onDismiss={() => setChoosing(false)}
        />
      ) : null}
    </div>
  )
}

function GroupFigure({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-lg leading-tight font-bold tabular-nums">
        {value}
      </span>
      <span className="text-[15px] text-muted-foreground">{label}</span>
    </span>
  )
}
