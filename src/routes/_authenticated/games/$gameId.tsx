import { useEffect, useState } from "react"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import {
  Bomb,
  Check,
  ChevronLeft,
  CircleX,
  Ellipsis,
  EyeOff,
  History,
  QrCode as QrCodeIcon,
  Swords,
  Trophy,
  Undo2,
} from "lucide-react"
import { BottomSheet } from "@/components/bottom-sheet"
import {
  PrimaryButton,
  SecondaryButton,
  largeSecondaryButtonClass,
} from "@/components/buttons"
import { ConfirmSheet } from "@/components/confirm-sheet"
import {
  LastEventBar,
  ParticipantRows,
  ScorekeeperStatus,
  SwimmerLabel,
} from "@/components/game-board"
import { LinkField } from "@/components/link-field"
import { QrCode } from "@/components/qr-code"
import {
  describeEvent,
  describeGameLength,
  describeExtraRound,
  describeLastEvent,
  genitive,
  joinNames,
  nameOf,
} from "@/lib/game-text"
import { useLiveGame } from "@/lib/use-live-game"
import { useShareLink } from "@/lib/use-share-link"
import { cn } from "@/lib/utils"
import { preview } from "@/rules-engine"
import { gameChanged, gameQuery } from "@/lib/queries"
import { stepsKey, useGameSteps } from "./-game-data"
import { useHideOut } from "./-hide-out"
import type { ComponentProps } from "react"
import type { GameEvent } from "@/rules-engine"
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
  // The Scorekeeper's steps still on their way load the Game again when done.
  const isBusy = () =>
    queryClient.isMutating({ mutationKey: stepsKey(gameId) }) > 0
  const { data: game } = useSuspenseQuery({
    ...gameQuery(gameId),
    // Coming back to the app shows the latest state.
    refetchOnWindowFocus: () => !isBusy(),
  })
  const groupId = game?.groupId
  useLiveGame({
    gameId: groupId ? gameId : null,
    version: game?.version ?? null,
    onChange: () => {
      if (groupId) void gameChanged(queryClient, gameId, groupId)
    },
    isBusy,
  })
  if (!game) return null
  if (game.status === "finished") return <GameEnd game={game} />
  if (game.status === "cancelled") return <Cancelled game={game} />
  return <GameTable game={game} />
}

type Sheet =
  | { kind: "swimmer"; thrower: string; candidates: Array<string> }
  | { kind: "winner"; event: GameEvent; winner: string; text: string }
  | { kind: "tiebreak" }
  | { kind: "menu" }
  | { kind: "spectators"; token: string }
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
  const { record, undo, addTiebreak, cancel, waiting } = useGameSteps(game.id, {
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

  const last = describeLastEvent(game)
  const { spectatorToken } = game
  const remaining = state.participants.filter((p) => p.status !== "out")
  // Only a loss decides a Round by Tiebreak, and only with more than two left
  // before it; two left play an Extra Round instead.
  const tiebreakFor =
    isScorekeeper &&
    !bombMode &&
    last?.event.type === "lost" &&
    !last.event.tiebreak &&
    last.before.participants.filter((p) => p.status !== "out").length > 2
      ? { loser: last.event.loser, before: last.before }
      : null
  const canExtraRound = isScorekeeper && !bombMode && remaining.length === 2
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
            {describeExtraRound(game.events, name(state.dealer)) ??
              game.groupName}
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

      <ScorekeeperStatus
        viewer={isScorekeeper ? "scorekeeper" : "participant"}
        scorekeeper={game.scorekeeper}
      />

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
        scorekeeperParticipantId={
          isScorekeeper ? null : game.scorekeeperParticipantId
        }
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
        <LastEventBar
          last={last}
          emptyText={`Noch keine Runde gezählt. ${name(state.dealer)} ist Dealer.`}
        >
          {tiebreakFor ? (
            <BarIconButton
              label="Stechen angeben"
              disabled={waiting}
              onClick={() => {
                setError(null)
                setSheet({ kind: "tiebreak" })
              }}
              className="text-primary"
            >
              <Swords className="size-5" aria-hidden="true" />
            </BarIconButton>
          ) : null}
          {isScorekeeper && last ? (
            <BarIconButton
              label="Rückgängig"
              disabled={waiting}
              onClick={() => {
                setError(null)
                setBombMode(false)
                void undo()
              }}
            >
              <Undo2 className="size-5" aria-hidden="true" />
            </BarIconButton>
          ) : null}
        </LastEventBar>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {isScorekeeper ? (
          <div className="flex gap-2.5">
            {bombMode ? (
              <SecondaryButton
                type="button"
                onClick={() => setBombMode(false)}
                className="h-14 flex-1 rounded-[14px] text-base"
              >
                Keine Bombe
              </SecondaryButton>
            ) : null}
            {canExtraRound ? (
              <SecondaryButton
                type="button"
                disabled={waiting}
                onClick={() => propose({ type: "extraRound" })}
                className="h-14 flex-1 rounded-[14px] text-base"
              >
                Extra-Runde
              </SecondaryButton>
            ) : null}
            {bombMode ? null : (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setBombMode(true)
                }}
                disabled={waiting}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-bomb bg-bomb-muted text-base font-semibold text-bomb disabled:opacity-40"
              >
                <Bomb className="size-5" aria-hidden="true" />
                Bombe
              </button>
            )}
          </div>
        ) : null}
      </div>

      {sheet?.kind === "menu" ? (
        <GameMenu
          gameId={game.id}
          onSpectators={
            spectatorToken
              ? () => setSheet({ kind: "spectators", token: spectatorToken })
              : undefined
          }
          hideOut={hideOut}
          onHideOut={setHideOut}
          onCancel={
            isScorekeeper ? () => setSheet({ kind: "cancel" }) : undefined
          }
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.kind === "spectators" ? (
        <SpectatorSheet token={sheet.token} onClose={() => setSheet(null)} />
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

      {sheet?.kind === "tiebreak" && tiebreakFor ? (
        <TiebreakSheet
          loser={tiebreakFor.loser}
          others={tiebreakFor.before.participants
            .filter((p) => p.status !== "out" && p.id !== tiebreakFor.loser)
            .map((p) => p.id)}
          name={name}
          onSave={(tiebreak) => {
            setSheet(null)
            void addTiebreak(tiebreak)
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

/**
 * The Tiebreak of the last loss, added after the fact: who else was in it
 * (at least one). The loser is fixed; only those still in before the loss
 * can be chosen.
 */
function TiebreakSheet({
  loser,
  others,
  name,
  onSave,
  onClose,
}: {
  loser: string
  /** Who else was still in before the loss, in Seating Order. */
  others: Array<string>
  name: (id: string) => string
  /** With everyone in the Tiebreak, the loser first. */
  onSave: (tiebreak: Array<string>) => void
  onClose: () => void
}) {
  const [chosen, setChosen] = useState<Array<string>>([])
  const toggle = (id: string) =>
    setChosen((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    )
  const cell =
    "flex h-13 min-w-0 items-center justify-between gap-2 rounded-xl border-[1.5px] px-3.5"
  return (
    <BottomSheet
      title="Stechen angeben"
      description={`Wer war mit ${name(loser)} im Stechen? Wähle mindestens eine Person.`}
      onDismiss={onClose}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className={cn(cell, "border-border bg-muted")}>
          <span className="truncate font-semibold">{name(loser)}</span>
          <span className="shrink-0 text-[13px] text-muted-foreground">
            verloren
          </span>
        </div>
        {others.map((id) => {
          const on = chosen.includes(id)
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(id)}
              className={cn(
                cell,
                "text-left font-semibold",
                on ? "border-primary bg-primary-muted" : "border-border"
              )}
            >
              <span className="truncate">{name(id)}</span>
              {on ? (
                <Check
                  className="size-4.5 shrink-0 text-primary"
                  strokeWidth={2.4}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="flex gap-2.5">
        <SecondaryButton
          type="button"
          onClick={onClose}
          className="h-13 flex-1 rounded-[14px] bg-transparent text-base"
        >
          Abbrechen
        </SecondaryButton>
        <PrimaryButton
          type="button"
          disabled={chosen.length === 0}
          onClick={() =>
            onSave([loser, ...others.filter((id) => chosen.includes(id))])
          }
          className="h-13 flex-1"
        >
          Speichern
        </PrimaryButton>
      </div>
    </BottomSheet>
  )
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

/**
 * A step in the bar with the last Event, as a 44 px icon, so the Event's
 * text keeps the width.
 */
function BarIconButton({
  label,
  className,
  ...props
}: Omit<ComponentProps<"button">, "aria-label"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl bg-background disabled:opacity-40",
        className
      )}
      {...props}
    />
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

/** "Zuschauer einladen": the Game's Spectator link as QR code and link. */
function SpectatorSheet({
  token,
  onClose,
}: {
  token: string
  onClose: () => void
}) {
  const link = useShareLink(`/z/${token}`, {
    title: "Schwimmen live",
    text: "Schau unserem Spiel Schwimmen live zu:",
  })
  return (
    <BottomSheet
      title="Zuschauer einladen"
      description="Wer den Code scannt, sieht das Spiel live, auch ohne Konto. Der Link gilt nur, solange das Spiel läuft."
      onDismiss={onClose}
    >
      <div className="size-53 self-center rounded-[20px] bg-white p-3.5">
        {link.url ? (
          <QrCode text={link.url} label="QR-Code des Zuschauer-Links" />
        ) : null}
      </div>
      <LinkField
        shownUrl={link.shownUrl}
        copied={link.copied}
        onCopy={link.copy}
      />
      {link.error ? (
        <p role="alert" className="text-sm text-destructive">
          {link.error}
        </p>
      ) : null}
      <div className="flex gap-2.5">
        <SecondaryButton
          type="button"
          onClick={onClose}
          className="h-13 flex-1 rounded-[14px] bg-transparent text-base"
        >
          Fertig
        </SecondaryButton>
        <PrimaryButton
          type="button"
          onClick={link.share}
          disabled={!link.url}
          className="h-13 flex-1"
        >
          Link teilen
        </PrimaryButton>
      </div>
    </BottomSheet>
  )
}

/** The sheet behind ⋯: history, hiding Participants who are Out, cancelling. */
function GameMenu({
  gameId,
  onSpectators,
  hideOut,
  onHideOut,
  onCancel,
  onClose,
}: {
  gameId: string
  /** While the Game runs. */
  onSpectators?: () => void
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
        {onSpectators ? (
          <button type="button" onClick={onSpectators} className={item}>
            <QrCodeIcon className="size-5.5 shrink-0" aria-hidden="true" />
            Zuschauer einladen
          </button>
        ) : null}
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
