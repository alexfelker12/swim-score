import { useState } from "react"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import {
  LastEventBar,
  ParticipantRows,
  ScorekeeperStatus,
} from "@/components/game-board"
import { LinkGone } from "@/components/link-gone"
import { AppMark } from "@/components/logo"
import { describeExtraRound, describeLastEvent, nameOf } from "@/lib/game-text"
import { spectatorGameChanged, spectatorGameQuery } from "@/lib/queries"
import { useLiveGame } from "@/lib/use-live-game"
import type { SpectatorView } from "@/server/games"

/**
 * A Spectator link: the running Game live and read-only, for anyone who
 * has the link, with or without an account.
 */
export const Route = createFileRoute("/z/$token")({
  loader: async ({ context, params }) => {
    const result = await context.queryClient.query(
      spectatorGameQuery(params.token)
    )
    if (!result.ok && result.code === "spectatorLinkNotFound") throw notFound()
  },
  head: () => ({
    meta: [
      { title: "Swim Score · Live" },
      // A shared link is no reason for search engines to list the Game.
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SpectatorPage,
})

function SpectatorPage() {
  const { token } = Route.useParams()
  const queryClient = useQueryClient()
  const { data: result } = useSuspenseQuery(spectatorGameQuery(token))
  const game = result.ok ? result.value : null
  // Once the Game is over the link shows nothing, but keeps listening: an
  // undone end makes the Game run again.
  const [gameId, setGameId] = useState(game?.id ?? null)
  if (game && game.id !== gameId) setGameId(game.id)
  useLiveGame({
    gameId,
    version: game?.version ?? null,
    onChange: () => void spectatorGameChanged(queryClient, token),
  })
  return game ? <LiveGame game={game} /> : <GameOver />
}

function LiveGame({ game }: { game: SpectatorView }) {
  const { state } = game
  const name = nameOf(game.participants)
  return (
    <div className="flex h-svh flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[52px_minmax(0,1fr)_52px] items-center px-1">
        <span className="justify-self-center">
          <AppMark />
        </span>
        <div className="flex min-w-0 flex-col items-center">
          <h1 className="text-xl leading-tight font-semibold">
            Runde {state.round}
          </h1>
          <span className="max-w-full truncate text-[13px] text-muted-foreground">
            {describeExtraRound(game.events, name(state.dealer)) ??
              game.groupName}
          </span>
        </div>
      </header>
      <ScorekeeperStatus
        viewer="spectator"
        scorekeeper={game.scorekeeper}
        offlineSince={game.scorekeeperOfflineSince}
        serverTime={game.serverTime}
      />
      <ParticipantRows
        participants={game.participants}
        states={state.participants}
        dealer={state.dealer}
        startingLives={game.ruleSet.startingLives}
        scorekeeperParticipantId={game.scorekeeperParticipantId}
      />
      <div className="shrink-0 px-4 pt-3 pb-5">
        <LastEventBar
          last={describeLastEvent(game)}
          emptyText={`Noch keine Runde gezählt. ${name(state.dealer)} ist Dealer.`}
        />
      </div>
    </div>
  )
}

function GameOver() {
  return (
    <LinkGone title="Dieses Spiel ist vorbei" action="Swim Score öffnen">
      Zuschauer-Links gelten nur, solange ein Spiel läuft. Das Ergebnis sehen
      alle Spieler der Gruppe in der App.
    </LinkGone>
  )
}
