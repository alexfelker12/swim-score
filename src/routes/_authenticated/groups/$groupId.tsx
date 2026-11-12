import { useSuspenseQuery } from "@tanstack/react-query"
import { useManagement } from "./-use-management"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { ChevronLeft, Settings, UserPlus } from "lucide-react"
import { SegmentedTabs } from "@/components/segmented-tabs"
import {
  groupGamesQuery,
  groupLeaderboardQuery,
  groupManagementQuery,
  groupQuery,
} from "@/lib/queries"
import { isCalendarDay } from "@/lib/dates"
import { GamesTab } from "./-games-tab"
import { LeaderboardTab } from "./-leaderboard-tab"
import type { Period } from "@/server/leaderboard"
import { PlayersTab } from "./-players-tab"

const TABS = ["games", "leaderboard", "players"] as const
type Tab = (typeof TABS)[number]

type GroupSearch = {
  tab?: Tab
  /** The Leaderboard's metric. */
  metric?: string
  /** The Leaderboard's period, `YYYY-MM-DD`; both or neither. */
  from?: string
  to?: string
}

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  validateSearch: (search: Record<string, unknown>): GroupSearch => ({
    ...(TABS.includes(search.tab as Tab) ? { tab: search.tab as Tab } : {}),
    ...(typeof search.metric === "string" ? { metric: search.metric } : {}),
    ...(isCalendarDay(search.from) && isCalendarDay(search.to)
      ? { from: search.from, to: search.to }
      : {}),
  }),
  loaderDeps: ({ search }) => ({
    leaderboard: search.tab === "leaderboard",
    from: search.from,
    to: search.to,
  }),
  loader: async ({ context, params, deps }) => {
    const { queryClient } = context
    const [group] = await Promise.all([
      queryClient.query(groupQuery(params.groupId)),
      queryClient.query(groupGamesQuery(params.groupId)),
      deps.leaderboard
        ? queryClient.query(
            groupLeaderboardQuery(params.groupId, {
              from: deps.from,
              to: deps.to,
            })
          )
        : null,
    ])
    if (!group) throw notFound()
    // Open Claims; only the Group Admin gets them.
    if (group.isAdmin) {
      await queryClient.query(groupManagementQuery(params.groupId))
    }
  },
  component: GroupPage,
})

function GroupPage() {
  const { groupId } = Route.useParams()
  const search = Route.useSearch()
  const { tab = "games" } = search
  const navigate = Route.useNavigate()
  const group = useSuspenseQuery(groupQuery(groupId)).data
  const { data: games } = useSuspenseQuery(groupGamesQuery(groupId))
  const management = useManagement(groupId, group?.isAdmin ?? false)
  if (!group) return null
  return (
    <div className="flex min-h-svh flex-col">
      <header className="grid h-15 shrink-0 grid-cols-[52px_minmax(0,1fr)_auto] items-center px-1">
        <Link
          to="/"
          aria-label="Zur Startseite"
          className="flex size-11 items-center justify-center justify-self-center rounded-xl"
        >
          <ChevronLeft className="size-6" aria-hidden="true" />
        </Link>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl leading-tight font-bold">
            {group.name}
          </h1>
          <span className="text-[13px] text-muted-foreground">
            {group.players.length} Spieler
          </span>
        </div>
        <div className="flex">
          {group.isAdmin ? (
            <Link
              to="/groups/$groupId/invite"
              params={{ groupId: group.id }}
              aria-label="In die Gruppe einladen"
              className="flex size-11 items-center justify-center rounded-xl"
            >
              <UserPlus className="size-6" aria-hidden="true" />
            </Link>
          ) : null}
          <Link
            to="/groups/$groupId/settings"
            params={{ groupId: group.id }}
            aria-label={group.isAdmin ? "Gruppe verwalten" : "Gruppe"}
            className="flex size-11 items-center justify-center rounded-xl"
          >
            <Settings className="size-6" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <SegmentedTabs
        label="Bereiche der Gruppe"
        value={tab}
        onChange={(next) =>
          navigate({
            search: (previous) => ({ ...previous, tab: next }),
            replace: true,
          })
        }
        options={[
          { value: "games", label: "Spiele" },
          { value: "leaderboard", label: "Rangliste" },
          { value: "players", label: "Spieler" },
        ]}
        className="mx-4 mt-1 mb-3"
      />

      {tab === "players" ? (
        <PlayersTab group={group} management={management} />
      ) : null}
      {tab === "games" ? <GamesTab groupId={group.id} games={games} /> : null}
      {tab === "leaderboard" ? (
        <GroupLeaderboard
          groupId={group.id}
          metricId={search.metric}
          period={{ from: search.from, to: search.to }}
        />
      ) : null}
    </div>
  )
}

function GroupLeaderboard({
  groupId,
  metricId,
  period,
}: {
  groupId: string
  metricId: string | undefined
  period: Period
}) {
  const navigate = Route.useNavigate()
  const { data: leaderboard } = useSuspenseQuery(
    groupLeaderboardQuery(groupId, period)
  )
  return (
    <LeaderboardTab
      leaderboard={leaderboard}
      metricId={metricId}
      period={period}
      onMetricChange={(metric) =>
        navigate({
          search: (previous) => ({ ...previous, metric }),
          replace: true,
        })
      }
      onPeriodChange={({ from, to }) =>
        navigate({
          search: (previous) => ({ ...previous, from, to }),
          replace: true,
        })
      }
    />
  )
}
