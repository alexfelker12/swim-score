import { useSuspenseQuery } from "@tanstack/react-query"
import { useManagement } from "./-use-management"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import {
  DicesIcon,
  PodiumIcon,
  Settings,
  UserGroupIcon,
  UserPlus,
} from "lucide-react"
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
import { Page } from "@/components/page"
import { PageNotFound } from "@/components/page-not-found"
import {
  PageLoading,
  PageLoadingContent,
  PageLoadingDescription,
  PageLoadingHeader,
  PageLoadingTitle,
} from "@/components/page-loading"
import { Skeleton } from "@/components/ui/skeleton"
import {
  groupGamesQuery,
  groupPlayersQuery,
  groupLeaderboardQuery,
  groupManagementQuery,
  groupQuery,
} from "@/lib/queries"
import { gameFilterOf, withoutGameFilter } from "@/lib/game-filter"
import { loadPageData } from "@/lib/page-data"
import { periodFromSearch } from "@/lib/period-search"
import { GamesTab } from "./-games-tab"
import { LeaderboardTab } from "./-leaderboard-tab"
import type { GameFilter } from "@/server/games"
import type { Period } from "@/server/stats"
import { PlayersTab } from "./-players-tab"

const TABS = ["games", "leaderboard", "players"] as const
type Tab = (typeof TABS)[number]

type GroupSearch = GameFilter & {
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
    ...gameFilterOf(search),
  }),
  loaderDeps: ({ search }) => ({
    games: gameFilterOf(search),
    leaderboard: search.tab === "leaderboard",
    players: search.tab === "players",
    from: search.from,
    to: search.to,
  }),
  loader: ({ context, params, deps, cause }) =>
    loadPageData(cause, async () => {
      const { queryClient } = context
      const [group] = await Promise.all([
        queryClient.query(groupQuery(params.groupId)),
        queryClient.fetchInfiniteQuery(
          groupGamesQuery(params.groupId, deps.games)
        ),
        deps.players
          ? queryClient.fetchInfiniteQuery(groupPlayersQuery(params.groupId))
          : null,
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
    }),
  pendingComponent: GroupLoading,
  component: GroupPage,
})

function GroupPage() {
  const { groupId } = Route.useParams()
  const search = Route.useSearch()
  const { tab = "games" } = search
  const navigate = Route.useNavigate()
  const group = useSuspenseQuery(groupQuery(groupId)).data
  const management = useManagement(groupId, group?.isAdmin ?? false)
  if (!group) return <PageNotFound />
  return (
    <Page>
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
          <TabsTrigger value="games">
            <DicesIcon />
            Spiele
          </TabsTrigger>
          <TabsTrigger value="leaderboard">
            <PodiumIcon />
            Rangliste
          </TabsTrigger>
          <TabsTrigger value="players">
            <UserGroupIcon />
            Spieler
          </TabsTrigger>
        </TabsList>
        <TabsContent value="games" className="flex flex-col">
          <GamesTab
            groupId={group.id}
            filter={gameFilterOf(search)}
            onFilterChange={(filter) =>
              navigate({
                search: (previous) => ({
                  ...withoutGameFilter(previous),
                  ...gameFilterOf(filter),
                }),
                replace: true,
              })
            }
          />
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
    </Page>
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

/** While the Group loads: its header, the tabs and the Games as placeholders. */
function GroupLoading() {
  return (
    <PageLoading>
      <PageLoadingHeader variant="start">
        <PageHeaderContent>
          <PageLoadingTitle />
          <PageLoadingDescription />
        </PageHeaderContent>
      </PageLoadingHeader>
      <PageLoadingContent className="pt-1">
        <Skeleton className="h-12" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} variant="card" className="h-20" />
        ))}
      </PageLoadingContent>
    </PageLoading>
  )
}
