import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { ChevronLeft, Settings, UserPlus } from "lucide-react"
import { SegmentedTabs } from "@/components/segmented-tabs"
import {
  getGroupFn,
  getGroupManagementFn,
  listGamesFn,
} from "@/server/functions"
import { GamesTab } from "./-games-tab"
import { PlayersTab } from "./-players-tab"

const TABS = ["games", "leaderboard", "players"] as const
type Tab = (typeof TABS)[number]

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
    TABS.includes(search.tab as Tab) ? { tab: search.tab as Tab } : {},
  loader: async ({ params }) => {
    const group = await getGroupFn({ data: { groupId: params.groupId } })
    if (!group) throw notFound()
    const [games, management] = await Promise.all([
      listGamesFn({ data: { groupId: params.groupId } }),
      // Open Claims and what linking a Guest needs; only the Group Admin gets them.
      group.isAdmin
        ? getGroupManagementFn({ data: { groupId: params.groupId } })
        : null,
    ])
    return { group, games, management }
  },
  component: GroupPage,
})

function GroupPage() {
  const { group, games, management } = Route.useLoaderData()
  const { tab = "games" } = Route.useSearch()
  const navigate = Route.useNavigate()
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
        onChange={(next) => navigate({ search: { tab: next }, replace: true })}
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
        <div role="tabpanel" className="px-5 py-6 text-muted-foreground">
          Die Rangliste erscheint, sobald ihr ein Spiel beendet habt.
        </div>
      ) : null}
    </div>
  )
}
