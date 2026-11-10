import { Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { primaryButtonClass } from "@/components/buttons"
import { formatDay, formatMonth, formatStarted, monthKey } from "@/lib/dates"
import type { GameListEntry } from "@/server/games"

/** Tab "Spiele": the running Games on top, then the others by month. */
export function GamesTab({
  groupId,
  games,
}: {
  groupId: string
  games: Array<GameListEntry>
}) {
  const running = games.filter((g) => g.status === "running")
  const past = games.filter((g) => g.status !== "running")
  const months: Array<{ key: string; label: string; games: typeof past }> = []
  for (const game of past) {
    const key = monthKey(game.startedAt)
    const last = months.at(-1)
    if (last?.key === key) last.games.push(game)
    else {
      months.push({ key, label: formatMonth(game.startedAt), games: [game] })
    }
  }
  return (
    <div role="tabpanel" className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
        {running.map((game) => (
          <RunningCard key={game.id} game={game} />
        ))}
        {months.map((group) => (
          <section
            key={group.key}
            aria-labelledby={`month-${group.key}`}
            className="flex flex-col gap-2"
          >
            <h2
              id={`month-${group.key}`}
              className="mx-1 mt-4 mb-1 text-[15px] font-semibold text-muted-foreground"
            >
              {group.label}
            </h2>
            {group.games.map((game) => (
              <PastCard key={game.id} game={game} />
            ))}
          </section>
        ))}
        {games.length === 0 ? (
          <p className="px-1 py-2 text-muted-foreground">
            Noch keine Spiele in dieser Gruppe.
          </p>
        ) : null}
      </div>
      <div className="sticky bottom-0 border-t border-border bg-background px-4 pt-3 pb-6">
        <Link
          to="/games/new"
          search={{ groupId }}
          className={primaryButtonClass}
        >
          <Plus className="size-5" aria-hidden="true" />
          Neues Spiel
        </Link>
      </div>
    </div>
  )
}

function RunningCard({ game }: { game: GameListEntry }) {
  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: game.id }}
      className="flex flex-col gap-1 rounded-[14px] border-[1.5px] border-primary bg-card px-4 py-3.5"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold text-primary">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          Läuft, Runde {game.round}
        </span>
        <span className="text-sm text-muted-foreground">
          {formatStarted(game.startedAt)}
        </span>
      </span>
      <span className="text-[17px] font-semibold">
        {game.participantCount} Teilnehmer, {game.scorekeeper} zählt
      </span>
      {game.swimmer ? (
        <span className="text-[15px] text-swimmer">
          {game.swimmer} schwimmt
        </span>
      ) : null}
    </Link>
  )
}

function PastCard({ game }: { game: GameListEntry }) {
  const cancelled = game.status === "cancelled"
  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: game.id }}
      className={
        cancelled
          ? "flex flex-col gap-1 rounded-[14px] border-[1.5px] border-dashed border-border px-4 py-3.5 text-muted-foreground"
          : "flex flex-col gap-1 rounded-[14px] border-[1.5px] border-border bg-card px-4 py-3.5"
      }
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-[17px] font-semibold">
          {cancelled ? "Abgebrochen" : `${game.winner} gewinnt`}
        </span>
        <span className="shrink-0 pt-0.5 text-sm text-muted-foreground">
          {formatDay(game.startedAt)}
        </span>
      </span>
      <span className="text-[15px] text-muted-foreground">
        {game.participantCount} Teilnehmer
        {cancelled ? ", zählt nicht" : null}
        {!cancelled && game.swimmer ? (
          <>
            , <span className="text-swimmer">Schwimmer {game.swimmer}</span>
          </>
        ) : null}
      </span>
    </Link>
  )
}
