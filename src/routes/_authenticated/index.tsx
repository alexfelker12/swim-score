import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { ChevronRight, Plus, QrCode } from "lucide-react"
import {
  largeSecondaryButtonClass,
  primaryButtonClass,
} from "@/components/buttons"
import { Logo } from "@/components/logo"
import { UserAvatar } from "@/components/user-avatar"
import { formatAgo, formatWhen } from "@/lib/dates"
import { homeQuery } from "@/lib/queries"
import { cn } from "@/lib/utils"
import type { Home, HomeGroup, RunningGame } from "@/server/home"

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ context }) => context.queryClient.query(homeQuery()),
  pendingComponent: StartLoading,
  component: Start,
})

/**
 * Start page: into a Game in two taps. A running Game to continue or watch,
 * "Neues Spiel" in the Group last played in, then "Meine Gruppen".
 */
function Start() {
  const { data: home } = useSuspenseQuery(homeQuery())
  return (
    <div className="flex min-h-svh flex-col">
      <StartHeader />
      {home.groups.length === 0 ? <Empty /> : <Overview home={home} />}
    </div>
  )
}

function StartHeader() {
  const { viewer } = Route.useRouteContext()
  return (
    <header className="flex h-16 shrink-0 items-center justify-between px-5">
      <Logo />
      <Link to="/profile" aria-label="Profil öffnen" className="rounded-full">
        <UserAvatar name={viewer.name} image={viewer.image} size={44} />
      </Link>
    </header>
  )
}

function Overview({ home }: { home: Home }) {
  const { runningGames, newGame } = home
  return (
    <main className="flex flex-col gap-3 px-4 pt-2 pb-6">
      {runningGames.length === 1 ? (
        <RunningGameCard game={runningGames[0]} />
      ) : runningGames.length > 1 ? (
        <section
          aria-labelledby="running-games"
          className="flex flex-col gap-3"
        >
          <h2 id="running-games" className="mx-1 text-[17px] font-semibold">
            Laufende Spiele
          </h2>
          {runningGames.map((game) => (
            <RunningGameCard key={game.id} game={game} compact />
          ))}
        </section>
      ) : null}

      {newGame ? (
        runningGames.length > 0 ? (
          <NewGameLink
            {...newGame}
            className={cn(largeSecondaryButtonClass, "gap-2")}
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            <NewGameLink
              {...newGame}
              className={cn(primaryButtonClass, "h-16 text-[17px]")}
            />
            {newGame.lastPlayedAt ? (
              <p className="text-center text-[15px] text-muted-foreground">
                Dort habt ihr zuletzt gespielt,{" "}
                {formatWhen(newGame.lastPlayedAt)}
              </p>
            ) : null}
          </div>
        )
      ) : null}

      <section aria-labelledby="my-groups" className="mt-4 flex flex-col gap-2">
        <h2 id="my-groups" className="mx-1 mb-1 text-[17px] font-semibold">
          Meine Gruppen
        </h2>
        {home.groups.map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}
        <Link
          to="/groups/new"
          className="flex h-14 items-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-border px-4 font-semibold text-primary"
        >
          <Plus className="size-5" aria-hidden="true" />
          Gruppe anlegen
        </Link>
      </section>
    </main>
  )
}

/**
 * A running Game: alone with "● Spiel läuft" and the short standings, among
 * several with how long ago it moved. "Weiterzählen" for the Scorekeeper,
 * "Mitsehen" for everyone else.
 */
function RunningGameCard({
  game,
  compact = false,
}: {
  game: RunningGame
  compact?: boolean
}) {
  const titleId = `running-${game.id}`
  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col rounded-[18px] border-[1.5px] bg-card",
        compact ? "gap-1 px-4 pt-4 pb-4" : "gap-1.5 px-5 pt-5 pb-5",
        // Alone it is the page's focus; among several, the one I keep score in.
        !compact || game.isScorekeeper ? "border-primary" : "border-border"
      )}
    >
      {compact ? null : (
        <span className="flex items-center gap-2.5 text-[15px] font-semibold text-primary">
          <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
          Spiel läuft
        </span>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={titleId}
          className={cn(
            "truncate font-bold",
            compact ? "text-[22px]" : "text-[28px] leading-tight"
          )}
        >
          {game.groupName}
        </h2>
        {compact ? (
          <span className="shrink-0 text-sm text-muted-foreground">
            {formatAgo(game.lastActivityAt)}
          </span>
        ) : null}
      </div>
      <p className="text-base text-muted-foreground">
        {runningGameSummary(game)}
      </p>
      {compact ? null : (
        <ul
          aria-label="Stand"
          className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-base"
        >
          {game.standings.map((s, i) => (
            <li
              key={i}
              className={cn(s.swimming && "font-semibold text-swimmer")}
            >
              {s.name}{" "}
              {s.swimming ? (
                "schwimmt"
              ) : (
                <span className="text-muted-foreground tabular-nums">
                  {s.lives}
                  <span className="sr-only"> Leben</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/games/$gameId"
        params={{ gameId: game.id }}
        className={cn(
          "mt-3",
          game.isScorekeeper ? primaryButtonClass : largeSecondaryButtonClass
        )}
      >
        {game.isScorekeeper ? "Weiterzählen" : "Mitsehen"}
      </Link>
    </article>
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

function NewGameLink({
  groupId,
  groupName,
  className,
}: {
  groupId: string
  groupName: string
  className: string
}) {
  return (
    <Link to="/games/new" search={{ groupId }} className={className}>
      <Plus className="size-5 shrink-0" aria-hidden="true" />
      <span className="truncate">Neues Spiel in {groupName}</span>
    </Link>
  )
}

function GroupCard({ group }: { group: HomeGroup }) {
  const players = `${group.playerCount} Spieler`
  const detail = group.running
    ? `${players}, Spiel läuft`
    : group.lastPlayedAt
      ? `${players}, zuletzt ${formatWhen(group.lastPlayedAt)}`
      : players
  return (
    <Link
      to="/groups/$groupId"
      params={{ groupId: group.id }}
      className="flex min-h-17 items-center justify-between gap-3 rounded-[14px] border-[1.5px] border-border bg-card px-4 py-2.5"
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[17px] font-semibold">{group.name}</span>
        <span className="text-[15px] text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </Link>
  )
}

function Empty() {
  const { viewer } = Route.useRouteContext()
  return (
    <>
      <main className="flex flex-1 flex-col justify-center gap-4 px-6 pb-10">
        <h1 className="text-[30px] font-bold">Hallo {viewer.name}</h1>
        <p className="text-lg text-pretty text-muted-foreground">
          Du bist noch in keiner Gruppe. Leg eine an und lade deine Runde ein,
          oder lass dir von jemandem den Einladungslink geben.
        </p>
        <div className="mt-2 flex gap-3.5 rounded-[14px] bg-muted p-4 text-[15px] text-muted-foreground">
          <QrCode className="mt-0.5 size-5.5 shrink-0" aria-hidden="true" />
          <span className="text-pretty">
            Am Tisch geht es am schnellsten: Der Verwalter zeigt den QR-Code, du
            scannst ihn mit der Kamera.
          </span>
        </div>
      </main>
      <div className="px-4 pb-6">
        <Link to="/groups/new" className={primaryButtonClass}>
          Gruppe anlegen
        </Link>
      </div>
    </>
  )
}

/** While the start page loads: its cards as quiet placeholders. */
function StartLoading() {
  const bar = "rounded-full bg-muted"
  return (
    <div className="flex min-h-svh flex-col">
      <StartHeader />
      <div
        role="status"
        aria-label="Lädt"
        className="flex flex-col gap-4 px-4 pt-2"
      >
        <div className="flex flex-col gap-3 rounded-[18px] bg-card p-5">
          <div className={cn(bar, "h-3.5 w-24")} />
          <div className={cn(bar, "h-6 w-50 rounded-lg")} />
          <div className={cn(bar, "h-3.5 w-40")} />
          <div className="mt-8 h-14 rounded-[14px] bg-muted" />
        </div>
        <div className="h-14 rounded-[14px] bg-card" />
        <div className={cn(bar, "mt-3 h-4 w-32")} />
        <div className="h-17 rounded-[14px] bg-card" />
        <div className="h-17 rounded-[14px] bg-card" />
      </div>
    </div>
  )
}
