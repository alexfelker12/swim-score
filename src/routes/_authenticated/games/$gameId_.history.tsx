import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { Bomb, ChevronLeft, Trophy } from "lucide-react"
import { formatLongDay, formatTime } from "@/lib/dates"
import {
  describeGameLength,
  describeHistory,
  withTakeovers,
} from "@/lib/game-text"
import { gameQuery } from "@/lib/queries"
import { cn } from "@/lib/utils"
import type { GameView } from "@/server/games"

/** "Spielverlauf": the Game Round by Round, for every Player of the Group. */
export const Route = createFileRoute("/_authenticated/games/$gameId_/history")({
  loader: async ({ context, params }) => {
    const game = await context.queryClient.query(gameQuery(params.gameId))
    if (!game) throw notFound()
  },
  component: HistoryPage,
})

function HistoryPage() {
  const { gameId } = Route.useParams()
  const game = useSuspenseQuery(gameQuery(gameId)).data
  if (!game) return null
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
    <div className="flex min-h-svh flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[52px_minmax(0,1fr)_52px] items-center px-1">
        <Link
          to="/games/$gameId"
          params={{ gameId }}
          aria-label="Zurück zum Spiel"
          className="flex size-11 items-center justify-center justify-self-center rounded-xl"
        >
          <ChevronLeft className="size-6" aria-hidden="true" />
        </Link>
        <div className="flex min-w-0 flex-col items-center">
          <h1 className="text-[17px] leading-tight font-semibold">
            Spielverlauf
          </h1>
          <span className="max-w-full truncate text-[13px] text-muted-foreground">
            {describeTime(game)}
          </span>
        </div>
      </header>

      <main className="flex flex-col px-4 pt-2 pb-8">
        <Outcome game={game} />
        {entries.length === 0 ? (
          <p className="pt-6 text-muted-foreground">
            Noch keine Runde gezählt.
          </p>
        ) : (
          <ol className="flex flex-col pt-2">
            {entries.map((entry, index) => (
              <li
                key={index}
                className="grid grid-cols-[50px_minmax(0,1fr)] border-b border-border py-3"
              >
                <span className="pl-1 text-[15px] text-muted-foreground tabular-nums">
                  {entry.round}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span
                    className={cn(
                      "flex items-start gap-2 text-[15px] text-pretty",
                      entry.end ? "font-semibold" : "font-medium",
                      (entry.extraRound || entry.takeover) &&
                        "text-muted-foreground"
                    )}
                  >
                    {entry.bomb ? (
                      <Bomb
                        className="mt-0.5 size-4.5 shrink-0 text-bomb"
                        aria-label="Bombe"
                      />
                    ) : null}
                    {entry.text}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {entry.meta}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
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
    <div className="flex items-center justify-between gap-3 rounded-[14px] border-[1.5px] border-border bg-card px-4 py-3.5">
      <div className="flex min-w-0 flex-col">
        <span className="text-xl font-semibold">{title}</span>
        <span className="text-[15px] text-muted-foreground">
          {game.status === "cancelled"
            ? `${length}, zählt in keine Statistik`
            : length}
        </span>
      </div>
      {game.status === "finished" ? (
        <Trophy
          className="size-7 shrink-0 text-primary"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      ) : null}
    </div>
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
