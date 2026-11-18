import { useSuspenseQuery } from "@tanstack/react-query"
import { useManagement } from "./-use-management"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { DicesIcon, PodiumIcon, Settings, UserGroupIcon, UserPlus } from "lucide-react"
import {
  PageHeader,
  PageHeaderAction,
  PageHeaderActions,
  PageHeaderBack,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  groupGamesQuery,
  groupLeaderboardQuery,
  groupManagementQuery,
  groupQuery,
} from "@/lib/queries"
import { periodFromSearch } from "@/lib/period-search"
import { GamesTab } from "./-games-tab"
import { LeaderboardTab } from "./-leaderboard-tab"
import type { Period } from "@/server/stats"
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
    ...periodFromSearch(search),
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
      <PageHeader variant="start">
        <PageHeaderBack render={<Link to="/" />} label="Zur Startseite" />
        <PageHeaderContent>
          <PageHeaderTitle>{group.name}</PageHeaderTitle>
          <PageHeaderDescription>
            {group.players.length} Spieler
          </PageHeaderDescription>
        </PageHeaderContent>
        <PageHeaderActions>
          {group.isAdmin ? (
            <PageHeaderAction
              render={
                <Link
                  to="/groups/$groupId/invite"
                  params={{ groupId: group.id }}
                />
              }
              label="In die Gruppe einladen"
            >
              <UserPlus />
            </PageHeaderAction>
          ) : null}
          <PageHeaderAction
            render={
              <Link
                to="/groups/$groupId/settings"
                params={{ groupId: group.id }}
              />
            }
            label={group.isAdmin ? "Gruppe verwalten" : "Gruppe"}
          >
            <Settings />
          </PageHeaderAction>
        </PageHeaderActions>
      </PageHeader>

      <Tabs
        value={tab}
        onValueChange={(next) =>
          navigate({
            search: (previous) => ({ ...previous, tab: next as Tab }),
            replace: true,
          })
        }
        className="flex-1 gap-3"
      >
        <TabsList aria-label="Bereiche der Gruppe" className="mx-4 mt-1 w-auto">
          <TabsTrigger value="games"><DicesIcon />Spiele</TabsTrigger>
          <TabsTrigger value="leaderboard"><PodiumIcon />Rangliste</TabsTrigger>
          <TabsTrigger value="players"><UserGroupIcon />Spieler</TabsTrigger>
        </TabsList>
        <TabsContent value="games" className="flex flex-col">
          <GamesTab groupId={group.id} games={games} />
        </TabsContent>
        <TabsContent value="leaderboard">
          <GroupLeaderboard
            groupId={group.id}
            metricId={search.metric}
            period={{ from: search.from, to: search.to }}
          />
        </TabsContent>
        <TabsContent value="players">
          <PlayersTab group={group} management={management} />
        </TabsContent>
      </Tabs>
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
