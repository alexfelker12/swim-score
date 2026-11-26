import { useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  Ban,
  Clock,
  Info,
  Layers,
  PencilLine,
  Plus,
  Trophy,
  Users,
  Waves,
} from "lucide-react"
import {
  GameCard,
  GameCardDate,
  GameCardFact,
  GameCardFacts,
  GameCardHeader,
  GameCardName,
  GameCardStatus,
  GameCardTitle,
} from "@/components/game-card"
import { ChipRow } from "@/components/chip-row"
import { ListEnd } from "@/components/list-end"
import { PageFooter } from "@/components/page-footer"
import { Section, SectionDescription, SectionTitle } from "@/components/section"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Toggle } from "@/components/ui/toggle"
import {
  formatDay,
  formatDuration,
  formatMonth,
  formatStarted,
  monthKey,
} from "@/lib/dates"
import {
  GAME_FILTERS,
  describeGameFilter,
  hasGameFilter,
} from "@/lib/game-filter"
import { usePagedQuery } from "@/lib/paged-query"
import { groupGamesQuery } from "@/lib/queries"
import type { GameFilter, GameListEntry } from "@/server/games"

/**
 * Tab "Spiele": filters (#60), the running Games on top, then the others by
 * month; more load at the end of the list (#59).
 */
export function GamesTab({
  groupId,
  filter,
  onFilterChange,
}: {
  groupId: string
  filter: GameFilter
  onFilterChange: (filter: GameFilter) => void
}) {
  const list = usePagedQuery(groupGamesQuery(groupId, filter))
  const filtered = hasGameFilter(filter)
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
      <GameFilters
        key={JSON.stringify(filter)}
        filter={filter}
        onChange={onFilterChange}
      />
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
        {games.length === 0 && filtered ? (
          <div className="flex flex-col items-start gap-1 px-1 py-2">
            <SectionDescription>
              Keine Spiele zu diesen Filtern: {describeGameFilter(filter)}.
            </SectionDescription>
            <Button variant="link" size="sm" onClick={() => onFilterChange({})}>
              Filter zurücksetzen
            </Button>
          </div>
        ) : games.length === 0 ? (
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

/**
 * The filters as chips, each on or off, all combined; "Zurücksetzen" once
 * one is on. A chip shows its new state at once, while the Games for it
 * load; give it the filter as `key`, so it starts afresh from the page's.
 */
function GameFilters({
  filter,
  onChange,
}: {
  filter: GameFilter
  onChange: (filter: GameFilter) => void
}) {
  const [shown, setShown] = useState(filter)
  const change = (next: GameFilter) => {
    setShown(next)
    onChange(next)
  }
  return (
    <ChipRow aria-label="Spiele filtern" className="px-4 pb-3">
      {GAME_FILTERS.map(({ key, label }) => (
        <Toggle
          key={key}
          variant="chip"
          pressed={shown[key] === true}
          onPressedChange={(on) => change({ ...shown, [key]: on })}
        >
          {label}
        </Toggle>
      ))}
      {hasGameFilter(shown) ? (
        <Button variant="ghost" size="xs" onClick={() => change({})}>
          Zurücksetzen
        </Button>
      ) : null}
    </ChipRow>
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
      <GameCardFacts>
        <ParticipantsFact count={game.participantCount} />
        {game.scorekeeper ? (
          <GameCardFact icon={PencilLine} label="Zähler">
            {game.scorekeeper}
          </GameCardFact>
        ) : null}
        <SwimmerFact name={game.swimmer} />
      </GameCardFacts>
    </GameCard>
  )
}

function PastCard({ game }: { game: GameListEntry }) {
  const cancelled = game.status === "cancelled"
  const duration = cancelled
    ? null
    : formatDuration(game.startedAt, game.finishedAt)
  return (
    <GameCard
      status={cancelled ? "cancelled" : "finished"}
      render={<Link to="/games/$gameId" params={{ gameId: game.id }} />}
    >
      <GameCardHeader>
        {cancelled ? (
          <GameCardTitle>
            <Ban aria-hidden="true" />
            Abgebrochen
          </GameCardTitle>
        ) : (
          <GameCardTitle>
            <Trophy aria-hidden="true" />
            <GameCardName>{game.winner}</GameCardName> gewinnt
          </GameCardTitle>
        )}
        <GameCardDate>{formatDay(game.startedAt)}</GameCardDate>
      </GameCardHeader>
      <GameCardFacts>
        <ParticipantsFact count={game.participantCount} />
        <GameCardFact icon={Layers}>
          {game.rounds} {game.rounds === 1 ? "Runde" : "Runden"}
        </GameCardFact>
        {duration ? (
          <GameCardFact icon={Clock} label="Dauer">
            {duration}
          </GameCardFact>
        ) : null}
        {cancelled ? (
          <GameCardFact icon={Info}>zählt nicht</GameCardFact>
        ) : (
          <SwimmerFact name={game.swimmer} />
        )}
      </GameCardFacts>
    </GameCard>
  )
}

function ParticipantsFact({ count }: { count: number }) {
  return (
    <GameCardFact icon={Users} label="Teilnehmer">
      {count}
    </GameCardFact>
  )
}

function SwimmerFact({ name }: { name: string | null }) {
  return name ? (
    <GameCardFact icon={Waves} label="Schwimmer" swimmer>
      {name}
    </GameCardFact>
  ) : null
}
