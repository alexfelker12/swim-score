import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import {
  GameOutcome,
  HistoryEntry,
  HistoryList,
} from "@/components/game-history"
import {
  PageHeader,
  PageHeaderBack,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/page-header"
import { SectionDescription } from "@/components/section"
import { Page } from "@/components/page"
import { PageNotFound } from "@/components/page-not-found"
import {
  PageLoading,
  PageLoadingContent,
  PageLoadingDescription,
  PageLoadingHeader,
} from "@/components/page-loading"
import { Skeleton } from "@/components/ui/skeleton"
import { loadPageData } from "@/lib/page-data"
import { formatLongDay, formatTime } from "@/lib/dates"
import {
  describeGameLength,
  describeHistory,
  withTakeovers,
} from "@/lib/game-text"
import { gameQuery } from "@/lib/queries"
import type { GameView } from "@/server/games"

/** "Spielverlauf": the Game Round by Round, for every Player of the Group. */
export const Route = createFileRoute("/_authenticated/games/$gameId_/history")({
  loader: ({ context, params, cause }) =>
    loadPageData(cause, async () => {
      const game = await context.queryClient.query(gameQuery(params.gameId))
      if (!game) throw notFound()
    }),
  pendingComponent: HistoryLoading,
  component: HistoryPage,
})

function HistoryPage() {
  const { gameId } = Route.useParams()
  const game = useSuspenseQuery(gameQuery(gameId)).data
  if (!game) return <PageNotFound />
  const names = new Map(game.participants.map((p) => [p.id, p.name]))
  const name = (id: string) => names.get(id) ?? ""
  const entries = withTakeovers(
    describeHistory(
      game.ruleSet,
      game.participants.map((p) => p.id),
      game.events,
      name
    ),
    game.takeovers,
    name
  )
  return (
    <Page>
      <PageHeader>
        <PageHeaderBack
          render={<Link to="/games/$gameId" params={{ gameId }} />}
          label="Zurück zum Spiel"
        />
        <PageHeaderContent>
          <PageHeaderTitle>Spielverlauf</PageHeaderTitle>
          <PageHeaderDescription>{describeTime(game)}</PageHeaderDescription>
        </PageHeaderContent>
      </PageHeader>

      <main className="flex flex-col px-4 pt-2 pb-8">
        <Outcome game={game} />
        {entries.length === 0 ? (
          <SectionDescription className="pt-6">
            Noch keine Runde gezählt.
          </SectionDescription>
        ) : (
          <HistoryList>
            {entries.map((entry, index) => (
              <HistoryEntry
                key={index}
                round={entry.round}
                text={entry.text}
                meta={entry.meta}
                bomb={entry.bomb}
                end={entry.end}
                muted={entry.extraRound || entry.takeover}
              />
            ))}
          </HistoryList>
        )}
      </main>
    </Page>
  )
}

/** Winner, cancellation or the current Round, with the Game's length. */
function Outcome({ game }: { game: GameView }) {
  const { state } = game
  const length = describeGameLength(
    game.events,
    state,
    game.participants.length
  )
  const winner = game.participants.find((p) => p.id === state.winner)
  const title =
    game.status === "finished" && winner
      ? `${winner.name} gewinnt`
      : game.status === "cancelled"
        ? "Abgebrochen"
        : `Läuft, Runde ${state.round}`
  return (
    <GameOutcome title={title} trophy={game.status === "finished"}>
      {game.status === "cancelled"
        ? `${length}, zählt in keine Statistik`
        : length}
    </GameOutcome>
  )
}

/** "Do., 5. November, 21:40 bis 22:20", or "…, seit 21:40" while it runs. */
function describeTime(game: GameView): string {
  const day = formatLongDay(game.startedAt)
  const from = formatTime(game.startedAt)
  return game.finishedAt
    ? `${day}, ${from} bis ${formatTime(game.finishedAt)}`
    : `${day}, seit ${from}`
}

/** While the Game loads: its Rounds as placeholders. */
function HistoryLoading() {
  return (
    <PageLoading>
      <PageLoadingHeader>
        <PageHeaderContent>
          <PageHeaderTitle>Spielverlauf</PageHeaderTitle>
          <PageLoadingDescription />
        </PageHeaderContent>
      </PageLoadingHeader>
      <PageLoadingContent>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="card" className="h-14" />
        ))}
      </PageLoadingContent>
    </PageLoading>
  )
}
