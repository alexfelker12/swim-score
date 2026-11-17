import { Link } from "@tanstack/react-router"
import { ChevronRight, Plus } from "lucide-react"
import {
  GameCardDate,
  GameCardStatus,
  GameCardSwimmer,
} from "@/components/game-card"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { formatAgo, formatWhen } from "@/lib/dates"
import type { HomeGroup, RunningGame } from "@/server/home"

// The parts of the start page (`i15-start`): a running Game, "Neues Spiel",
// a Group row and the placeholders while it loads.

/**
 * A running Game: alone (`lg`) with "● Spiel läuft" and the short standings,
 * among several (`compact`) with how long ago it moved. "Weiterzählen" for
 * the Scorekeeper, "Mitsehen" for everyone else.
 */
export function RunningGameCard({
  game,
  compact = false,
}: {
  game: RunningGame
  compact?: boolean
}) {
  const titleId = `running-${game.id}`
  return (
    <Card
      render={<article aria-labelledby={titleId} />}
      size={compact ? "md" : "lg"}
      // Alone it is the page's focus; among several, the one I keep score in.
      variant={!compact || game.isScorekeeper ? "primary" : "default"}
    >
      {compact ? null : <GameCardStatus size="lg">Spiel läuft</GameCardStatus>}
      <CardHeader className="items-baseline">
        <CardTitle
          as="h2"
          id={titleId}
          size={compact ? "lg" : "xl"}
          className="min-w-0 truncate"
        >
          {game.groupName}
        </CardTitle>
        {compact ? (
          <GameCardDate className="self-baseline pt-0">
            {formatAgo(game.lastActivityAt)}
          </GameCardDate>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className="text-base text-muted-foreground">
          {runningGameSummary(game)}
        </p>
        {compact ? null : (
          <ul
            aria-label="Stand"
            className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-base"
          >
            {game.standings.map((s, i) => (
              <li key={i}>
                {s.swimming ? (
                  <GameCardSwimmer strong>{s.name} schwimmt</GameCardSwimmer>
                ) : (
                  <>
                    {s.name}{" "}
                    <span className="text-muted-foreground tabular-nums">
                      {s.lives}
                      <span className="sr-only"> Leben</span>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="mt-3">
        <Button
          size="xl"
          variant={game.isScorekeeper ? "default" : "secondary"}
          nativeButton={false}
          render={<Link to="/games/$gameId" params={{ gameId: game.id }} />}
        >
          {game.isScorekeeper ? "Weiterzählen" : "Mitsehen"}
        </Button>
      </CardFooter>
    </Card>
  )
}

/** "Runde 5, 6 Teilnehmer, du zählst" or "…, Ben zählt". */
function runningGameSummary(game: RunningGame): string {
  const who = game.isScorekeeper
    ? "du zählst"
    : game.scorekeeper
      ? `${game.scorekeeper} zählt`
      : "niemand zählt"
  return `Runde ${game.round}, ${game.participantCount} Teilnehmer, ${who}`
}

/**
 * "+ Neues Spiel in …": the page's main action (`2xl`, primary) while no Game
 * runs, a secondary one beside a running Game.
 */
export function NewGameButton({
  groupId,
  groupName,
  primary,
}: {
  groupId: string
  groupName: string
  primary: boolean
}) {
  return (
    <Button
      size={primary ? "2xl" : "xl"}
      variant={primary ? "default" : "secondary"}
      nativeButton={false}
      render={<Link to="/games/new" search={{ groupId }} />}
    >
      <Plus />
      <span className="truncate">Neues Spiel in {groupName}</span>
    </Button>
  )
}

/** A Group under "Meine Gruppen": name, Players and when it last played. */
export function GroupRow({ group }: { group: HomeGroup }) {
  const players = `${group.playerCount} Spieler`
  const detail = group.running
    ? `${players}, Spiel läuft`
    : group.lastPlayedAt
      ? `${players}, zuletzt ${formatWhen(group.lastPlayedAt)}`
      : players
  return (
    <Item
      variant="card"
      size="lg"
      render={<Link to="/groups/$groupId" params={{ groupId: group.id }} />}
    >
      <ItemContent className="min-w-0 gap-0">
        <ItemTitle className="block truncate">{group.name}</ItemTitle>
        <ItemDescription>{detail}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <ChevronRight aria-hidden="true" />
      </ItemActions>
    </Item>
  )
}

/** While the start page loads: its cards as quiet placeholders. */
export function HomeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Lädt"
      className="flex flex-col gap-4 px-4 pt-2"
    >
      <Skeleton variant="card" className="flex flex-col gap-3 p-5">
        <Skeleton variant="line" className="h-3.5 w-24" />
        <Skeleton variant="line" className="h-6 w-50" />
        <Skeleton variant="line" className="h-3.5 w-40" />
        <Skeleton className="mt-8 h-14" />
      </Skeleton>
      <Skeleton variant="card" className="h-14" />
      <Skeleton variant="line" className="mx-1 mt-3 h-4 w-32" />
      <Skeleton variant="card" className="h-17" />
      <Skeleton variant="card" className="h-17" />
    </div>
  )
}
