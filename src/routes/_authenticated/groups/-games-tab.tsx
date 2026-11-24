import { Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import {
  GameCard,
  GameCardDate,
  GameCardDescription,
  GameCardHeader,
  GameCardStatus,
  GameCardSwimmer,
  GameCardTitle,
} from "@/components/game-card"
import { ListEnd } from "@/components/list-end"
import { PageFooter } from "@/components/page-footer"
import { Section, SectionDescription, SectionTitle } from "@/components/section"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDay, formatMonth, formatStarted, monthKey } from "@/lib/dates"
import { usePagedQuery } from "@/lib/paged-query"
import { groupGamesQuery } from "@/lib/queries"
import type { GameListEntry } from "@/server/games"

/**
 * Tab "Spiele": the running Games on top, then the others by month; more
 * load at the end of the list (#59).
 */
export function GamesTab({ groupId }: { groupId: string }) {
  const list = usePagedQuery(groupGamesQuery(groupId))
  const games = list.items
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
    <>
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
        {running.map((game) => (
          <RunningCard key={game.id} game={game} />
        ))}
        {months.map((group) => (
          <Section key={group.key} aria-labelledby={`month-${group.key}`}>
            <SectionTitle
              id={`month-${group.key}`}
              variant="muted"
              className="mx-1 mt-4 mb-1"
            >
              {group.label}
            </SectionTitle>
            {group.games.map((game) => (
              <PastCard key={game.id} game={game} />
            ))}
          </Section>
        ))}
        <ListEnd
          list={list}
          placeholder={<Skeleton variant="card" className="h-20" />}
        />
        {games.length === 0 ? (
          <SectionDescription className="px-1 py-2">
            Noch keine Spiele in dieser Gruppe.
          </SectionDescription>
        ) : null}
      </div>
      <PageFooter variant="sticky">
        <Button
          size="xl"
          nativeButton={false}
          render={<Link to="/games/new" search={{ groupId }} />}
        >
          <Plus />
          Neues Spiel
        </Button>
      </PageFooter>
    </>
  )
}

function RunningCard({ game }: { game: GameListEntry }) {
  return (
    <GameCard
      status="running"
      render={<Link to="/games/$gameId" params={{ gameId: game.id }} />}
    >
      <GameCardHeader>
        <GameCardStatus>Läuft, Runde {game.round}</GameCardStatus>
        <GameCardDate>{formatStarted(game.startedAt)}</GameCardDate>
      </GameCardHeader>
      <GameCardTitle>
        {game.participantCount} Teilnehmer
        {game.scorekeeper ? `, ${game.scorekeeper} zählt` : null}
      </GameCardTitle>
      {game.swimmer ? (
        <GameCardDescription>
          <GameCardSwimmer>{game.swimmer} schwimmt</GameCardSwimmer>
        </GameCardDescription>
      ) : null}
    </GameCard>
  )
}

function PastCard({ game }: { game: GameListEntry }) {
  const cancelled = game.status === "cancelled"
  return (
    <GameCard
      status={cancelled ? "cancelled" : "finished"}
      render={<Link to="/games/$gameId" params={{ gameId: game.id }} />}
    >
      <GameCardHeader>
        <GameCardTitle>
          {cancelled ? "Abgebrochen" : `${game.winner} gewinnt`}
        </GameCardTitle>
        <GameCardDate>{formatDay(game.startedAt)}</GameCardDate>
      </GameCardHeader>
      <GameCardDescription>
        {game.participantCount} Teilnehmer
        {cancelled ? ", zählt nicht" : null}
        {!cancelled && game.swimmer ? (
          <>
            , <GameCardSwimmer>Schwimmer {game.swimmer}</GameCardSwimmer>
          </>
        ) : null}
      </GameCardDescription>
    </GameCard>
  )
}
