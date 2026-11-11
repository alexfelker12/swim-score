import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import {
  Bomb,
  ChevronLeft,
  CircleX,
  Ellipsis,
  Eye,
  EyeOff,
  History,
  Trophy,
  Undo2,
  Waves,
} from "lucide-react"
import { BottomSheet } from "@/components/bottom-sheet"
import {
  PrimaryButton,
  SecondaryButton,
  largeSecondaryButtonClass,
} from "@/components/buttons"
import { ConfirmSheet } from "@/components/confirm-sheet"
import { DealerBadge } from "@/components/dealer-badge"
import {
  describeEvent,
  describeGameLength,
  genitive,
  joinNames,
} from "@/lib/game-text"
import { cn } from "@/lib/utils"
import { preview, replay } from "@/rules-engine"
import { gameQuery } from "@/lib/queries"
import { stepsKey, useGameSteps } from "./-game-data"
import { useHideOut } from "./-hide-out"
import type { GameEvent, ParticipantState } from "@/rules-engine"
import type { GameParticipant, GameView } from "@/server/games"

export const Route = createFileRoute("/_authenticated/games/$gameId")({
  loader: async ({ context, params }) => {
    const game = await context.queryClient.query(gameQuery(params.gameId))
    if (!game) throw notFound()
  },
  component: GamePage,
})

function GamePage() {
  const { gameId } = Route.useParams()
  const queryClient = useQueryClient()
  const { data: game } = useSuspenseQuery({
    ...gameQuery(gameId),
    // Coming back to the app shows the latest state, but not while the
    // Scorekeeper's steps are still on their way.
    refetchOnWindowFocus: () =>
      queryClient.isMutating({ mutationKey: stepsKey(gameId) }) === 0,
  })
  if (!game) return null
  if (game.status === "finished") return <GameEnd game={game} />
  if (game.status === "cancelled") return <Cancelled game={game} />
  return <GameTable game={game} />
}

type Sheet =
  | { kind: "swimmer"; thrower: string; candidates: Array<string> }
  | { kind: "winner"; event: GameEvent; winner: string; text: string }
  | { kind: "menu" }
  | { kind: "cancel" }

const stepErrors: Partial<Record<string, string>> = {
  versionConflict:
    "Der Stand hatte sich inzwischen geändert. Er ist jetzt neu geladen, tipp bitte noch einmal.",
  network:
    "Keine Verbindung zum Server. Der Stand ist neu geladen, tipp bitte noch einmal.",
  notScorekeeper: "Du zählst dieses Spiel nicht mehr.",
  gameNotRunning: "Das Spiel läuft nicht mehr.",
  nothingToUndo: "Es gibt nichts mehr zurückzunehmen.",
  undoExpired: "Die 10 Minuten sind um, das Spiel bleibt beendet.",
}

function GameTable({ game }: { game: GameView }) {
  const [bombMode, setBombMode] = useState(false)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hideOut, setHideOut] = useHideOut()
  const { record, undo, cancel, waiting } = useGameSteps(game.id, {
    onRefused: (code) => {
      setSheet(null)
      setError(stepErrors[code] ?? "Das ließ sich nicht speichern.")
    },
  })
  const { state, ruleSet } = game
  const name = nameOf(game.participants)
  const { isScorekeeper } = game

  /** Records the Event, unless it ends the Game: then the Winner is confirmed first. */
  function propose(event: GameEvent) {
    setError(null)
    const result = preview(state, ruleSet, event)
    if (!result.ok) {
      setError("Das geht nach den Regeln nicht.")
      return
    }
    if (result.state.finished && result.state.winner) {
      setSheet({
        kind: "winner",
        event,
        winner: name(result.state.winner),
        text: `${describeEvent(state, ruleSet, event, name, { withWinner: false })}. Damit endet das Spiel nach ${result.state.round} Runden.`,
      })
      return
    }
    setSheet(null)
    void record(event)
  }

  function tap(id: string) {
    if (!bombMode) return propose({ type: "lost", loser: id })
    setBombMode(false)
    const result = preview(state, ruleSet, { type: "bomb", thrower: id })
    if (!result.ok && result.reason.code === "swimmerChoiceRequired") {
      setSheet({
        kind: "swimmer",
        thrower: id,
        candidates: result.reason.candidates,
      })
      return
    }
    propose({ type: "bomb", thrower: id })
  }

  const last = lastEvent(game)
  const hidden = hideOut
    ? state.participants.filter((p) => p.status === "out").length
    : 0
  return (
    <div className="flex h-svh flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[52px_minmax(0,1fr)_52px] items-center px-1">
        <BackToGroup groupId={game.groupId} />
        <div className="flex min-w-0 flex-col items-center">
          <h1 className="text-xl leading-tight font-semibold">
            Runde {state.round}
          </h1>
          <span className="max-w-full truncate text-[13px] text-muted-foreground">
            {game.groupName}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSheet({ kind: "menu" })}
          aria-label="Spiel"
          className="flex size-11 items-center justify-center justify-self-center rounded-xl"
        >
          <Ellipsis className="size-6" aria-hidden="true" />
        </button>
      </header>

      <div className="shrink-0 px-4 pb-2">
        <div className="flex h-10 items-center gap-2.5 rounded-xl bg-muted px-3.5 text-sm">
          {isScorekeeper ? (
            <>
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-primary"
              />
              <span className="font-semibold">Du zählst</span>
            </>
          ) : (
            <>
              <Eye
                className="size-4.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span>
                {game.scorekeeper ? (
                  <>
                    Du schaust zu,{" "}
                    <span className="font-semibold">{game.scorekeeper}</span>{" "}
                    zählt
                  </>
                ) : (
                  // The Scorekeeper's account was deleted; taking over comes with #9.
                  "Du schaust zu, niemand zählt"
                )}
              </span>
            </>
          )}
        </div>
      </div>

      {isScorekeeper ? (
        <p
          className={cn(
            "flex h-8.5 shrink-0 items-center px-5 text-[15px]",
            bombMode ? "font-semibold text-bomb" : "text-muted-foreground"
          )}
        >
          {bombMode
            ? "Wer hat die Bombe geworfen?"
            : "Wer hat die Runde verloren?"}
        </p>
      ) : null}

      <ParticipantRows
        participants={game.participants}
        states={state.participants}
        dealer={state.dealer}
        startingLives={ruleSet.startingLives}
        bombMode={bombMode}
        hideOut={hideOut}
        onTap={isScorekeeper && !waiting ? tap : null}
      />

      {hidden > 0 ? (
        <p className="shrink-0 px-4 pt-1 text-center text-[15px] text-muted-foreground">
          {hidden === 1
            ? "1 Ausgeschiedener ausgeblendet."
            : `${hidden} Ausgeschiedene ausgeblendet.`}{" "}
          <button
            type="button"
            onClick={() => setHideOut(false)}
            className="font-semibold text-primary"
          >
            Anzeigen
          </button>
        </p>
      ) : null}

      <div className="flex shrink-0 flex-col gap-2.5 px-4 pt-3 pb-5">
        <div className="flex min-h-14 items-center gap-2 rounded-[14px] bg-muted py-1.5 pr-1.5 pl-3.5">
          {last ? (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-muted-foreground">
                Runde {last.round}
              </span>
              <span className="text-[15px] leading-snug font-medium text-pretty">
                {last.text}
              </span>
            </div>
          ) : (
            <span className="flex-1 text-[15px] text-muted-foreground">
              Noch keine Runde gezählt. {name(state.dealer)} ist Dealer.
            </span>
          )}
          {isScorekeeper && last ? (
            <UndoButton
              disabled={waiting}
              onClick={() => {
                setError(null)
                setBombMode(false)
                void undo()
              }}
            />
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {isScorekeeper ? (
          bombMode ? (
            <SecondaryButton
              type="button"
              onClick={() => setBombMode(false)}
              className="h-14 rounded-[14px] text-base"
            >
              Keine Bombe
            </SecondaryButton>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError(null)
                setBombMode(true)
              }}
              disabled={waiting}
              className="flex h-14 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-bomb bg-bomb-muted text-base font-semibold text-bomb disabled:opacity-40"
            >
              <Bomb className="size-5" aria-hidden="true" />
              Bombe
            </button>
          )
        ) : null}
      </div>

      {sheet?.kind === "menu" ? (
        <GameMenu
          gameId={game.id}
          hideOut={hideOut}
          onHideOut={setHideOut}
          onCancel={
            isScorekeeper ? () => setSheet({ kind: "cancel" }) : undefined
          }
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.kind === "cancel" ? (
        <ConfirmSheet
          title="Spiel abbrechen?"
          description="Das Spiel bleibt in der Spielliste der Gruppe sichtbar, zählt aber in keine Statistik. Das lässt sich nicht zurücknehmen."
          confirmLabel="Spiel abbrechen"
          cancelLabel="Weiterspielen"
          onConfirm={async () => {
            const refused = await cancel()
            if (refused === undefined) return
            return stepErrors[refused] ?? "Das ließ sich nicht abbrechen."
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.kind === "swimmer" ? (
        <BottomSheet
          title="Wer wird Schwimmer?"
          description={`${genitive(name(sheet.thrower))} Bombe trifft ${joinNames(sheet.candidates.map(name))} mit dem letzten Leben. Eine Person wird Schwimmer, die anderen scheiden aus.`}
          onDismiss={() => setSheet(null)}
        >
          <div className="flex flex-col gap-2.5">
            {sheet.candidates.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  propose({ type: "bomb", thrower: sheet.thrower, swimmer: id })
                }
                className="flex h-15 items-center justify-between rounded-[14px] border-[1.5px] border-swimmer bg-swimmer-muted px-4.5 text-left"
              >
                <span className="text-lg font-semibold">{name(id)}</span>
                <SwimmerLabel />
              </button>
            ))}
          </div>
          <SecondaryButton
            type="button"
            onClick={() => setSheet(null)}
            className="h-13 rounded-[14px] bg-transparent text-base"
          >
            Bombe zurücknehmen
          </SecondaryButton>
        </BottomSheet>
      ) : null}

      {sheet?.kind === "winner" ? (
        <BottomSheet
          centered
          title={
            <>
              <Trophy
                className="size-8 shrink-0 text-primary"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span className="text-[34px] font-bold">
                {sheet.winner} gewinnt
              </span>
            </>
          }
          description={sheet.text}
          onDismiss={() => setSheet(null)}
        >
          <div className="flex flex-col gap-2.5">
            <PrimaryButton
              type="button"
              disabled={waiting}
              onClick={() => void record(sheet.event, { optimistic: false })}
            >
              Spiel beenden
            </PrimaryButton>
            <SecondaryButton
              type="button"
              onClick={() => setSheet(null)}
              className="h-13 rounded-[14px] bg-transparent text-base"
            >
              Zurück, falsch getippt
            </SecondaryButton>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  )
}

const ROW_GAP = 6

/**
 * One row per Participant in Seating Order, high enough to fill the space
 * without scrolling (52–88 px), so 9 players fit on a phone.
 */
function ParticipantRows({
  participants,
  states,
  dealer,
  startingLives,
  bombMode,
  hideOut,
  onTap,
}: {
  participants: Array<GameParticipant>
  states: Array<ParticipantState>
  dealer: string
  startingLives: number
  bombMode: boolean
  /** Leave out the rows of Participants who are Out. */
  hideOut: boolean
  /** Null when the viewer does not record, or the Game is about to end. */
  onTap: ((id: string) => void) | null
}) {
  const box = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(64)
  const rows = participants
    .map((participant, seat) => ({ participant, state: states[seat] }))
    .filter(({ state }) => !(hideOut && state.status === "out"))
  const count = rows.length
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const fit = () => {
      const free = element.clientHeight - ROW_GAP * (count - 1)
      setHeight(Math.max(52, Math.min(88, Math.floor(free / count))))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [count])
  const largeText = height >= 70

  return (
    <div
      ref={box}
      className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-2"
    >
      {rows.map(({ participant, state }) => {
        const out = state.status === "out"
        const swimming = state.status === "swimming"
        const status = out
          ? "ausgeschieden"
          : swimming
            ? "schwimmt"
            : `${state.lives} Leben`
        const tappable = onTap !== null && !out
        const className = cn(
          "relative flex w-full shrink-0 items-center justify-between gap-3 rounded-[14px] border-[1.5px] bg-card px-4.5 text-left",
          out
            ? "border-dashed border-border bg-transparent opacity-50"
            : bombMode && tappable
              ? "border-bomb"
              : swimming
                ? "border-swimmer"
                : "border-border"
        )
        const content = (
          <>
            <span
              className={cn(
                "truncate font-semibold",
                largeText ? "text-[21px]" : "text-lg"
              )}
            >
              {participant.name}
            </span>
            {out ? (
              <span className="shrink-0 text-sm text-muted-foreground">
                ausgeschieden
              </span>
            ) : swimming ? (
              <SwimmerLabel />
            ) : (
              <LifeBar lives={state.lives} of={startingLives} />
            )}
            {participant.id === dealer && !out ? (
              <DealerBadge placement="corner" />
            ) : null}
          </>
        )
        return tappable ? (
          <button
            key={participant.id}
            type="button"
            style={{ height }}
            onClick={() => onTap(participant.id)}
            aria-label={`${participant.name}, ${status}. Tippen: ${bombMode ? "wirft die Bombe" : "verliert die Runde"}`}
            className={className}
          >
            {content}
          </button>
        ) : (
          <div
            key={participant.id}
            style={{ height }}
            aria-label={`${participant.name}, ${status}`}
            role="group"
            className={className}
          >
            {content}
          </div>
        )
      })}
    </div>
  )
}

/** Lives as a bar of segments; lost ones stay as an outline. */
function LifeBar({ lives, of }: { lives: number; of: number }) {
  return (
    <span aria-hidden="true" className="flex w-21 shrink-0 gap-1">
      {Array.from({ length: of }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-2.5 flex-1 rounded-[5px]",
            index < lives
              ? "bg-foreground"
              : "shadow-[inset_0_0_0_1.5px_var(--life-off)]"
          )}
        />
      ))}
    </span>
  )
}

function SwimmerLabel() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[15px] font-semibold text-swimmer">
      <Waves className="size-5.5" aria-hidden="true" />
      schwimmt
    </span>
  )
}

function BackToGroup({ groupId }: { groupId: string }) {
  return (
    <Link
      to="/groups/$groupId"
      params={{ groupId }}
      search={{ tab: "games" }}
      aria-label="Zur Gruppe"
      className="flex size-11 items-center justify-center justify-self-center rounded-xl"
    >
      <ChevronLeft className="size-6" aria-hidden="true" />
    </Link>
  )
}

/** Names by Participant id. */
function nameOf(participants: Array<GameParticipant>) {
  const names = new Map(participants.map((p) => [p.id, p.name]))
  return (id: string) => names.get(id) ?? ""
}

/** The last Event's Round and text, or null before the first. */
function lastEvent(game: GameView) {
  const event = game.events.at(-1)
  if (!event) return null
  const before = replay(
    game.ruleSet,
    game.participants.map((p) => p.id),
    game.events.slice(0, -1)
  )
  return {
    round: before.round,
    text: describeEvent(before, game.ruleSet, event, nameOf(game.participants)),
  }
}

function GameEnd({ game }: { game: GameView }) {
  const { state } = game
  const name = nameOf(game.participants)
  const meta = describeGameLength(game.events, state, game.participants.length)
  const [error, setError] = useState<string | null>(null)
  const { undo, waiting } = useGameSteps(game.id, {
    onRefused: (code) =>
      setError(stepErrors[code] ?? "Das ließ sich nicht zurücknehmen."),
  })
  const minutesLeft = useMinutesLeft(game.undoableUntil)
  return (
    <div className="flex min-h-svh flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[52px_minmax(0,1fr)_52px] items-center px-1">
        <BackToGroup groupId={game.groupId} />
        <h1 className="text-center text-[17px] font-semibold">Spiel beendet</h1>
        <HistoryLink gameId={game.id} />
      </header>
      <div className="flex flex-col items-center gap-2 px-6 pt-6 pb-7 text-center">
        <div className="flex items-center justify-center gap-3">
          <Trophy
            className="size-9 shrink-0 text-primary"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <h2 className="text-[34px] leading-tight font-bold tracking-tight">
            {state.winner ? name(state.winner) : ""} gewinnt
          </h2>
        </div>
        <p className="text-[15px] text-muted-foreground">{meta}</p>
      </div>
      <table className="mx-4 text-left tabular-nums">
        <thead>
          <tr className="border-b border-border text-sm text-muted-foreground">
            <th scope="col" className="w-14 py-2 pl-3 font-normal">
              Platz
            </th>
            <th scope="col" className="py-2 font-normal">
              <span className="sr-only">Name</span>
            </th>
            <th scope="col" className="w-18 py-2 text-right font-normal">
              Leben
            </th>
            <th scope="col" className="w-22 py-2 pr-3 text-right font-normal">
              Bomben
            </th>
          </tr>
        </thead>
        <tbody>
          {ranking(game.participants).map(({ participant, place }) => (
            <tr
              key={participant.id}
              // The Swimmer's row is tinted for now; an animation follows later.
              className={cn(
                "h-12 border-b border-border",
                participant.summary?.swam && "bg-swimmer/12"
              )}
            >
              <td
                className={cn(
                  "pl-3 text-lg",
                  place === 1
                    ? "font-bold text-primary"
                    : "font-medium text-muted-foreground"
                )}
              >
                {place}
              </td>
              <td
                className={cn(
                  "text-lg",
                  place === 1 ? "font-bold" : "font-medium"
                )}
              >
                {participant.name}
                {participant.summary?.swam ? (
                  <span className="sr-only">, Schwimmer</span>
                ) : null}
              </td>
              <td className="text-right text-muted-foreground">
                {formatLivesLost(participant.summary?.livesLost ?? 0)}
              </td>
              <td className="pr-3 text-right text-muted-foreground">
                {participant.summary?.bombs ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-auto flex flex-col gap-2.5 px-4 pt-6 pb-6">
        {game.isScorekeeper && minutesLeft !== null ? (
          <div className="flex items-center gap-2 rounded-[14px] bg-muted py-1.5 pr-1.5 pl-3.5">
            <p className="flex-1 text-sm text-pretty text-muted-foreground">
              Falsch gezählt? Der letzte Schritt lässt sich noch{" "}
              {minutesLeft === 1 ? "1 Minute" : `${minutesLeft} Minuten`}{" "}
              zurücknehmen.
            </p>
            <UndoButton
              disabled={waiting}
              onClick={() => {
                setError(null)
                void undo({ optimistic: false })
              }}
            />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Link
          to="/groups/$groupId"
          params={{ groupId: game.groupId }}
          search={{ tab: "games" }}
          className={largeSecondaryButtonClass}
        >
          Zur Gruppe
        </Link>
      </div>
    </div>
  )
}

/**
 * Whole minutes until `until`, counted up and kept current; null once it has
 * passed. Null on the server too, since only the browser knows the time the
 * page is looked at.
 */
function useMinutesLeft(until: Date | null): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    if (!until) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [until])
  if (!until || now === null) return null
  const left = until.getTime() - now
  return left > 0 ? Math.ceil(left / 60_000) : null
}

function UndoButton({
  disabled,
  onClick,
}: {
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-background px-3.5 text-[15px] font-semibold disabled:opacity-40"
    >
      <Undo2 className="size-4.5" aria-hidden="true" />
      Rückgängig
    </button>
  )
}

function HistoryLink({ gameId }: { gameId: string }) {
  return (
    <Link
      to="/games/$gameId/history"
      params={{ gameId }}
      aria-label="Spielverlauf"
      className="flex size-11 items-center justify-center justify-self-center rounded-xl"
    >
      <History className="size-5.5" aria-hidden="true" />
    </Link>
  )
}

/** The sheet behind ⋯: history, hiding Participants who are Out, cancelling. */
function GameMenu({
  gameId,
  hideOut,
  onHideOut,
  onCancel,
  onClose,
}: {
  gameId: string
  hideOut: boolean
  onHideOut: (hide: boolean) => void
  /** Only for the Scorekeeper. */
  onCancel?: () => void
  onClose: () => void
}) {
  const item =
    "flex h-14 w-full items-center gap-3.5 border-b border-border text-left text-[17px]"
  return (
    <BottomSheet title="Spiel" onDismiss={onClose}>
      <div className="flex flex-col">
        <Link to="/games/$gameId/history" params={{ gameId }} className={item}>
          <History className="size-5.5 shrink-0" aria-hidden="true" />
          Spielverlauf
        </Link>
        <button
          type="button"
          role="switch"
          aria-checked={hideOut}
          onClick={() => onHideOut(!hideOut)}
          className={item}
        >
          <EyeOff className="size-5.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">Ausgeschiedene ausblenden</span>
          <span
            aria-hidden="true"
            className={cn(
              "flex h-7 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
              hideOut ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "size-6 rounded-full bg-foreground transition-transform",
                hideOut && "translate-x-4 bg-primary-foreground"
              )}
            />
          </span>
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className={cn(item, "border-b-0 text-destructive")}
          >
            <CircleX className="size-5.5 shrink-0" aria-hidden="true" />
            Spiel abbrechen
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        className={largeSecondaryButtonClass}
      >
        Schließen
      </button>
    </BottomSheet>
  )
}

/** "−3", or "0" for none. */
function formatLivesLost(lives: number) {
  return lives === 0 ? "0" : `−${lives}`
}

/** Winner first, then whoever went Out last; those Out in the same Round share a place. */
function ranking(participants: Array<GameParticipant>) {
  const outLater = (p: GameParticipant) =>
    p.summary?.won ? Infinity : (p.summary?.outPosition ?? 0)
  return [...participants]
    .sort((a, b) => outLater(b) - outLater(a))
    .map((participant) => ({
      participant,
      place:
        1 +
        participants.filter((q) => outLater(q) > outLater(participant)).length,
    }))
}

function Cancelled({ game }: { game: GameView }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[52px_minmax(0,1fr)_52px] items-center px-1">
        <BackToGroup groupId={game.groupId} />
        <h1 className="text-center text-[17px] font-semibold">
          Spiel abgebrochen
        </h1>
        <HistoryLink gameId={game.id} />
      </header>
      <p className="px-6 pt-6 text-muted-foreground">
        Dieses Spiel wurde abgebrochen und zählt in keiner Statistik.
      </p>
    </div>
  )
}
