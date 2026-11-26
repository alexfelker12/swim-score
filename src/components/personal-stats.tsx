import { Link } from "@tanstack/react-router"
import { Bomb, ChevronRight, Trophy, Waves } from "lucide-react"
import {
  PeriodPicker,
  PeriodPickerContent,
  PeriodPickerTrigger,
} from "@/components/period-picker"
import { Section, SectionDescription, SectionTitle } from "@/components/section"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatMetricValue } from "@/lib/metric-format"
import type { LucideIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
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
  const groupsId = `groups-${profile.userId}`
  return (
    <div className="flex flex-col gap-7 px-4 pb-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 pt-2 pl-1">
          <SectionTitle>Über alle Gruppen</SectionTitle>
          <PeriodPicker
            since={profile.since}
            years={profile.years}
            period={period}
            onPeriodChange={onPeriodChange}
          >
            <PeriodPickerTrigger />
            <PeriodPickerContent />
          </PeriodPicker>
        </div>
        <StatTiles>
          {profile.totals.map((metric) => (
            <StatTile
              key={metric.id}
              label={metric.name}
              value={formatMetricValue(metric.value, metric.unit)}
            />
          ))}
        </StatTiles>
      </div>

      {profile.groups.length > 0 ? (
        <Section aria-labelledby={groupsId} className="gap-3">
          <SectionTitle id={groupsId} className="pl-1">
            {profile.isMe ? "Nach Gruppe" : "In euren gemeinsamen Gruppen"}
          </SectionTitle>
          <ul className="flex flex-col gap-2.5">
            {profile.groups.map((group) => (
              <li key={group.groupId}>
                <Card
                  size="sm"
                  className="gap-2.5"
                  render={
                    <Link
                      to="/groups/$groupId"
                      params={{ groupId: group.groupId }}
                      search={{ tab: "leaderboard", ...period }}
                    />
                  }
                >
                  <CardHeader>
                    <CardTitle className="truncate">{group.name}</CardTitle>
                    <CardAction>
                      <LeaderboardHint />
                    </CardAction>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-2">
                    <GroupFigure
                      icon={Trophy}
                      value={formatMetricValue(group.winRate, "percent")}
                      label="Winrate"
                    />
                    <GroupFigure
                      icon={Waves}
                      tone="swimmer"
                      value={formatMetricValue(group.swimRate, "percent")}
                      label={
                        <>
                          <span className="sr-only">Schwimmer-</span>Quote
                        </>
                      }
                    />
                    <GroupFigure
                      icon={Bomb}
                      tone="bomb"
                      value={formatMetricValue(group.bombsPerGame, "decimal")}
                      label={
                        <>
                          <span className="sr-only">Bomben </span>pro Spiel
                        </>
                      }
                    />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          {profile.isMe ? null : (
            <SectionDescription className="px-1">
              Hier stehen nur Gruppen, die ihr beide teilt. Die Werte oben
              zählen alle Spiele von {profile.name}.
            </SectionDescription>
          )}
        </Section>
      ) : null}
    </div>
  )
}

/** The metric tiles, two per row. */
function StatTiles(props: ComponentProps<"dl">) {
  return <dl className="grid grid-cols-2 gap-2.5" {...props} />
}

/** One metric: the value large (26 px), its name under it. */
function StatTile({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <Card size="xs" className="flex-col-reverse">
      <dt className="text-[15px] text-muted-foreground">{label}</dt>
      <dd className="text-[26px] leading-tight font-bold tabular-nums">
        {value}
      </dd>
    </Card>
  )
}

/** "Rangliste ›" on a Group card, in the primary colour. */
function LeaderboardHint() {
  return (
    <span className="flex items-center text-[15px] font-medium text-primary">
      Rangliste
      <ChevronRight className="size-5" aria-hidden="true" />
    </span>
  )
}

/**
 * One rate of a Group (#62): the value with its icon ("20 % 🏆"), what it
 * is under it, short, since the icon says the rest ("Winrate", "Quote",
 * "pro Spiel"). The icon in the colour of what it stands for: trophy
 * `primary`, Swimmer blue, Bomb yellow.
 */
function GroupFigure({
  icon: Icon,
  tone = "primary",
  value,
  label,
}: {
  icon: LucideIcon
  tone?: "primary" | "swimmer" | "bomb"
  value: string
  label: ReactNode
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex items-center gap-1.5 text-lg leading-tight font-bold tabular-nums">
        {value}
        <Icon
          aria-hidden="true"
          data-tone={tone}
          className="size-4.5 shrink-0 data-[tone=bomb]:text-bomb data-[tone=primary]:text-primary data-[tone=swimmer]:text-swimmer"
        />
      </span>
      <span className="text-sm leading-snug text-muted-foreground">
        {label}
      </span>
    </span>
  )
}
