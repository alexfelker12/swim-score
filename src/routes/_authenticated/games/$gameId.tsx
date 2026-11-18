import { useEffect, useRef, useState } from "react"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import {
  Bomb,
  Check,
  CircleX,
  Ellipsis,
  EyeOff,
  History,
  QrCode as QrCodeIcon,
  Swords,
  TriangleAlert,
  Trophy,
  Undo2,
} from "lucide-react"
import {
  HiddenOutNote,
  LastEventAction,
  LastEventBar,
  ParticipantRows,
  ScorekeeperStatus,
  SwimmerLabel,
  TablePrompt,
  TiebreakLoser,
} from "@/components/game-board"
import { ResultRow, ResultTable, WinnerHeading } from "@/components/game-result"
import { LinkField } from "@/components/link-field"
import { PageFooter } from "@/components/page-footer"
import {
  PageHeader,
  PageHeaderAction,
  PageHeaderBack,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/page-header"
import { QrCard, QrCode } from "@/components/qr-code"
import { SectionDescription } from "@/components/section"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { FieldError } from "@/components/ui/field"
import {
  Item,
  ItemButton,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Switch } from "@/components/ui/switch"
import { Toggle } from "@/components/ui/toggle"
import { Page } from "@/components/page"
import {
  describeEvent,
  describeGameLength,
  describeExtraRound,
  describeLastEvent,
  genitive,
  joinNames,
  nameOf,
} from "@/lib/game-text"
import { formatOfflineForLong } from "@/lib/takeover"
import { useLiveGame } from "@/lib/use-live-game"
import { useServerNow } from "@/lib/use-server-now"
import { useShareLink } from "@/lib/use-share-link"
import { useSheet } from "@/lib/use-sheet"
import { preview } from "@/rules-engine"
import { gameChanged, gameQuery } from "@/lib/queries"
import {
  cancelKey,
  useGameSteps,
  useStepQueue,
  useTakeOver,
  withQueuedSteps,
} from "./-game-data"
import { stepQueue } from "./-step-queue"
import { useHideOut } from "./-hide-out"
import { useWakeLock } from "@/lib/use-wake-lock"
import type { ReactNode } from "react"
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
  const { viewer } = Route.useRouteContext()
  const queryClient = useQueryClient()
  // The Scorekeeper's steps still on their way load the Game again when done.
  const isBusy = () =>
    stepQueue(gameId, viewer.id).get().steps.length > 0 ||
    queryClient.isMutating({ mutationKey: cancelKey(gameId) }) > 0
  const queue = useStepQueue(gameId, viewer.id)
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
    // Participants with an account let the server know they are here.
    present: Boolean(game && (game.isScorekeeper || game.canTakeOver)),
  })
  if (!game) return null
  if (game.status === "finished") {
    return <GameEnd game={game} viewerId={viewer.id} />
  }
  if (game.status === "cancelled") {
    return <Cancelled game={game} viewerId={viewer.id} />
  }
  return <GameTable game={withQueuedSteps(game, queue)} viewerId={viewer.id} />
}

type Sheet =
  | { kind: "swimmer"; thrower: string; candidates: Array<string> }
  | { kind: "winner"; event: GameEvent; winner: string; text: string }
  | { kind: "tiebreak" }
  | { kind: "menu" }
  | { kind: "spectators"; token: string }
  | { kind: "takeOver" }
  | { kind: "replaced"; by: string; offline: boolean; discarded: number }
  | { kind: "discarded"; reason: string; discarded: number }
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
  scorekeeperJustWentOffline:
    "Gerade erst offline gegangen. Übernehmen geht nach Ablauf der Zeit.",
  alreadyScorekeeper: "Du zählst schon.",
  notParticipant: "Übernehmen können nur Teilnehmer mit Konto.",
  serverError:
    "Der Server hat einen Fehler gemeldet. Der Stand ist neu geladen, tipp bitte noch einmal.",
  offline:
    "Ohne Verbindung geht das nicht. Erst müssen die gezählten Runden gesendet sein.",
}

/** Why the server dropped Rounds counted on this device, for the sheet. */
const discardReasons: Partial<Record<string, string>> = {
  versionConflict: "Der Stand auf dem Server hatte sich inzwischen geändert.",
  gameNotRunning: "Das Spiel läuft nicht mehr.",
  gameNotFound: "Das Spiel gibt es nicht mehr.",
  serverError: "Der Server hat einen Fehler gemeldet.",
}

function GameTable({ game, viewerId }: { game: GameView; viewerId: string }) {
  // Only while there is something to count: not once the Game is decided,
  // even if the server doesn't know yet (last round still queued).
  useWakeLock(game.isScorekeeper && !game.state.finished)
  const [bombMode, setBombMode] = useState(false)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hideOut, setHideOut] = useHideOut()
  // Rounds refused because someone else took over: told in one sheet,
  // also when they come back after it opened.
  const discarded = useRef(0)
  const {
    record,
    undo,
    addTiebreak,
    dropUnsentEnd,
    cancel,
    waiting,
    unsentRounds,
  } = useGameSteps(game.id, viewerId, {
    onRefused: ({ code, discardedRounds: rounds, afterOffline }) => {
      if (code === "notScorekeeper") {
        // Told by the sheet once the Game shows who keeps score now.
        if (sheet?.kind === "replaced") {
          setSheet((open) =>
            open?.kind === "replaced"
              ? { ...open, discarded: open.discarded + rounds }
              : open
          )
        } else {
          discarded.current += rounds
        }
        return
      }
      setBombMode(false)
      // More than the one step just tapped is lost: say so plainly.
      if (afterOffline || rounds > 1) {
        setError(null)
        setSheet({
          kind: "discarded",
          reason:
            discardReasons[code] ?? "Der Server hat sie nicht angenommen.",
          discarded: rounds,
        })
        return
      }
      setSheet(null)
      setError(stepErrors[code] ?? "Das ließ sich nicht speichern.")
    },
  })
  const { takeOver, takingOver } = useTakeOver(game.id, game.groupId)
  const { state, ruleSet } = game
  const name = nameOf(game.participants)
  const { isScorekeeper } = game
  const lastTakeover = game.takeovers.at(-1)
  const replacedBy = lastTakeover ? name(lastTakeover.by) : ""
  const replacedOffline = lastTakeover?.fromWasOffline ?? false

  // Someone took over from this device: say so once, with what was lost.
  const wasScorekeeper = useRef(isScorekeeper)
  useEffect(() => {
    if (wasScorekeeper.current && !isScorekeeper && replacedBy) {
      setBombMode(false)
      setError(null)
      setSheet({
        kind: "replaced",
        by: replacedBy,
        offline: replacedOffline,
        discarded: discarded.current,
      })
      discarded.current = 0
    }
    wasScorekeeper.current = isScorekeeper
  }, [isScorekeeper, replacedBy, replacedOffline])

  async function startTakeOver(confirmOffline = false) {
    setError(null)
    const refused = await takeOver({ confirmOffline })
    if (refused === "takeoverNeedsConfirmation") {
      setSheet({ kind: "takeOver" })
      return
    }
    setSheet(null)
    if (refused)
      setError(stepErrors[refused] ?? "Das ließ sich nicht übernehmen.")
  }

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
    <Page height="screen">
      <PageHeader>
        <BackToGroup groupId={game.groupId} />
        <PageHeaderContent>
          <PageHeaderTitle size="lg">Runde {state.round}</PageHeaderTitle>
          <PageHeaderDescription>
            {describeExtraRound(game.events, name(state.dealer)) ??
              game.groupName}
          </PageHeaderDescription>
        </PageHeaderContent>
        <PageHeaderAction
          label="Spiel"
          onClick={() => setSheet({ kind: "menu" })}
          className="col-start-3"
        >
          <Ellipsis />
        </PageHeaderAction>
      </PageHeader>

      <ScorekeeperStatus
        viewer={isScorekeeper ? "scorekeeper" : "participant"}
        unsentRounds={isScorekeeper ? unsentRounds : null}
        scorekeeper={game.scorekeeper}
        offlineSince={game.scorekeeperOfflineSince}
        serverTime={game.serverTime}
        onTakeOver={game.canTakeOver ? () => void startTakeOver() : undefined}
        takingOver={takingOver}
      />

      {isScorekeeper ? (
        <TablePrompt bomb={bombMode}>
          {bombMode
            ? "Wer hat die Bombe geworfen?"
            : "Wer hat die Runde verloren?"}
        </TablePrompt>
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
        <HiddenOutNote count={hidden} onShow={() => setHideOut(false)} />
      ) : null}

      <div className="flex shrink-0 flex-col gap-2.5 px-4 pt-3 pb-5">
        <LastEventBar
          last={last}
          emptyText={`Noch keine Runde gezählt. ${name(state.dealer)} ist Dealer.`}
        >
          {tiebreakFor ? (
            <LastEventAction
              label="Stechen angeben"
              tone="primary"
              disabled={waiting}
              onClick={() => {
                setError(null)
                setSheet({ kind: "tiebreak" })
              }}
            >
              <Swords />
            </LastEventAction>
          ) : null}
          {isScorekeeper && last ? (
            <LastEventAction
              label="Rückgängig"
              disabled={waiting}
              onClick={() => {
                setError(null)
                setBombMode(false)
                void undo()
              }}
            >
              <Undo2 />
            </LastEventAction>
          ) : null}
        </LastEventBar>
        <FieldError>{error}</FieldError>
        {isScorekeeper ? (
          <div className="flex gap-2.5 *:flex-1">
            {bombMode ? (
              <Button
                variant="secondary"
                size="xl"
                onClick={() => setBombMode(false)}
              >
                Keine Bombe
              </Button>
            ) : null}
            {canExtraRound ? (
              <Button
                variant="secondary"
                size="xl"
                disabled={waiting}
                onClick={() => propose({ type: "extraRound" })}
              >
                Extra-Runde
              </Button>
            ) : null}
            {bombMode ? null : (
              <Button
                variant="bomb"
                size="xl"
                disabled={waiting}
                onClick={() => {
                  setError(null)
                  setBombMode(true)
                }}
              >
                <Bomb />
                Bombe
              </Button>
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

      {sheet?.kind === "takeOver" ? (
        <TakeOverSheet
          scorekeeper={game.scorekeeper ?? ""}
          offlineSince={game.scorekeeperOfflineSince}
          serverTime={game.serverTime}
          pending={takingOver}
          onConfirm={() => void startTakeOver(true)}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.kind === "replaced" ? (
        <ReplacedSheet {...sheet} onClose={() => setSheet(null)} />
      ) : null}

      {sheet?.kind === "discarded" ? (
        <DiscardedSheet {...sheet} onClose={() => setSheet(null)} />
      ) : null}

      {sheet?.kind === "cancel" ? (
        <CancelSheet
          onCancel={async () => {
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
            // Let go of the sheet at once: the bar changes with the step.
            setSheet(null)
            void addTiebreak(tiebreak)
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.kind === "swimmer" ? (
        <GameSheet onClose={() => setSheet(null)}>
          <DrawerHeader>
            <DrawerTitle>Wer wird Schwimmer?</DrawerTitle>
            <DrawerDescription>
              {genitive(name(sheet.thrower))} Bombe trifft{" "}
              {joinNames(sheet.candidates.map(name))} mit dem letzten Leben.
              Eine Person wird Schwimmer, die anderen scheiden aus.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            {sheet.candidates.map((id) => (
              <Button
                key={id}
                variant="swimmer"
                onClick={() =>
                  propose({ type: "bomb", thrower: sheet.thrower, swimmer: id })
                }
                className="justify-between"
              >
                <span className="truncate">{name(id)}</span>
                <SwimmerLabel />
              </Button>
            ))}
            <DrawerClose render={<Button variant="secondary" size="lg" />}>
              Bombe zurücknehmen
            </DrawerClose>
          </DrawerFooter>
        </GameSheet>
      ) : null}

      {sheet?.kind === "winner" ? (
        <GameSheet
          onClose={() => {
            // An end not sent yet is taken back with it.
            dropUnsentEnd()
            setSheet(null)
          }}
        >
          <DrawerHeader align="center">
            <DrawerTitle size="lg">
              <Trophy />
              {sheet.winner} gewinnt
            </DrawerTitle>
            <DrawerDescription>
              {waiting && unsentRounds !== null
                ? "Das Spiel endet, sobald wieder Verbindung da ist."
                : sheet.text}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button
              size="xl"
              disabled={waiting}
              onClick={() => record(sheet.event, { optimistic: false })}
            >
              Spiel beenden
            </Button>
            <DrawerClose render={<Button variant="secondary" size="lg" />}>
              Zurück, falsch getippt
            </DrawerClose>
          </DrawerFooter>
        </GameSheet>
      ) : null}
    </Page>
  )
}

/**
 * A sheet of the Game: open while mounted, `onClose` once it has closed
 * (after its exit), so the page can let go of it. Closing waits while
 * `pending`.
 */
function GameSheet({
  onClose,
  pending = false,
  children,
}: {
  onClose: () => void
  pending?: boolean
  children: ReactNode
}) {
  const { drawer } = useSheet(onClose)
  return (
    <Drawer
      {...drawer}
      onOpenChange={(next) => {
        if (!pending) drawer.onOpenChange(next)
      }}
    >
      <DrawerContent>{children}</DrawerContent>
    </Drawer>
  )
}

function BackToGroup({ groupId }: { groupId: string }) {
  return (
    <PageHeaderBack
      render={
        <Link
          to="/groups/$groupId"
          params={{ groupId }}
          search={{ tab: "games" }}
        />
      }
      label="Zur Gruppe"
    />
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
  return (
    <GameSheet onClose={onClose}>
      <DrawerHeader>
        <DrawerTitle>Stechen angeben</DrawerTitle>
        <DrawerDescription>
          Wer war mit {name(loser)} im Stechen? Wähle mindestens eine Person.
        </DrawerDescription>
      </DrawerHeader>
      <div className="grid grid-cols-2 gap-2">
        <TiebreakLoser name={name(loser)} />
        {others.map((id) => (
          <Toggle
            key={id}
            variant="seat"
            pressed={chosen.includes(id)}
            onPressedChange={(on) =>
              setChosen((ids) =>
                on ? [...ids, id] : ids.filter((x) => x !== id)
              )
            }
          >
            <span className="truncate">{name(id)}</span>
            {chosen.includes(id) ? <Check /> : null}
          </Toggle>
        ))}
      </div>
      <DrawerFooter orientation="horizontal">
        <DrawerClose render={<Button variant="secondary" size="lg" />}>
          Abbrechen
        </DrawerClose>
        <DrawerClose
          render={<Button size="lg" />}
          disabled={chosen.length === 0}
          onClick={() =>
            onSave([loser, ...others.filter((id) => chosen.includes(id))])
          }
        >
          Speichern
        </DrawerClose>
      </DrawerFooter>
    </GameSheet>
  )
}

/** "Spiel abbrechen?": `onCancel` returns an error to show, or nothing when done. */
function CancelSheet({
  onCancel,
  onClose,
}: {
  onCancel: () => Promise<string | undefined>
  onClose: () => void
}) {
  const sheet = useSheet(onClose)
  return (
    <Drawer {...sheet.drawer}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Spiel abbrechen?</DrawerTitle>
          <DrawerDescription>
            Das Spiel bleibt in der Spielliste der Gruppe sichtbar, zählt aber
            in keine Statistik. Das lässt sich nicht zurücknehmen.
          </DrawerDescription>
        </DrawerHeader>
        <FieldError>{sheet.error}</FieldError>
        <DrawerFooter>
          <Button
            variant="destructive"
            size="xl"
            disabled={sheet.pending}
            onClick={() => void sheet.run(onCancel)}
          >
            Spiel abbrechen
          </Button>
          <DrawerClose
            render={<Button variant="secondary" size="xl" />}
            disabled={sheet.pending}
          >
            Weiterspielen
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function GameEnd({ game, viewerId }: { game: GameView; viewerId: string }) {
  const { state } = game
  const name = nameOf(game.participants)
  const meta = describeGameLength(game.events, state, game.participants.length)
  const [error, setError] = useState<string | null>(null)
  const { undo, waiting } = useGameSteps(game.id, viewerId, {
    onRefused: ({ code }) =>
      setError(stepErrors[code] ?? "Das ließ sich nicht zurücknehmen."),
  })
  const minutesLeft = useMinutesLeft(game.undoableUntil)
  return (
    <Page>
      <PageHeader>
        <BackToGroup groupId={game.groupId} />
        <PageHeaderTitle>Spiel beendet</PageHeaderTitle>
        <HistoryLink gameId={game.id} />
      </PageHeader>
      <WinnerHeading winner={state.winner ? name(state.winner) : ""}>
        {meta}
      </WinnerHeading>
      <div className="px-4">
        <ResultTable>
          {ranking(game.participants).map(({ participant, place }) => (
            <ResultRow
              key={participant.id}
              place={place}
              name={participant.name}
              // The Swimmer's row is tinted for now; an animation follows later.
              swimmer={participant.summary?.swam ?? false}
              livesLost={formatLivesLost(participant.summary?.livesLost ?? 0)}
              bombs={participant.summary?.bombs ?? 0}
            />
          ))}
        </ResultTable>
      </div>
      <PageFooter className="mt-auto pt-6">
        {game.isScorekeeper && minutesLeft !== null ? (
          <LastEventBar
            last={null}
            emptyText={`Falsch gezählt? Der letzte Schritt lässt sich noch ${minutesLeft === 1 ? "1 Minute" : `${minutesLeft} Minuten`} zurücknehmen.`}
          >
            <LastEventAction
              label="Rückgängig"
              showLabel
              disabled={waiting}
              onClick={() => {
                setError(null)
                void undo({ optimistic: false })
              }}
            >
              <Undo2 />
            </LastEventAction>
          </LastEventBar>
        ) : null}
        <FieldError>{error}</FieldError>
        <Button
          size="xl"
          nativeButton={false}
          render={
            <Link
              to="/games/new"
              search={{ groupId: game.groupId, fromGame: game.id }}
            />
          }
        >
          Nochmal mit denselben Teilnehmern
        </Button>
        <Button
          variant="secondary"
          size="xl"
          nativeButton={false}
          render={
            <Link
              to="/groups/$groupId"
              params={{ groupId: game.groupId }}
              search={{ tab: "games" }}
            />
          }
        >
          Zur Gruppe
        </Button>
      </PageFooter>
    </Page>
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

function HistoryLink({ gameId }: { gameId: string }) {
  return (
    <PageHeaderAction
      render={<Link to="/games/$gameId/history" params={{ gameId }} />}
      label="Spielverlauf"
      className="col-start-3"
    >
      <History />
    </PageHeaderAction>
  )
}

/**
 * "Zählen übernehmen?": the warning before replacing a Scorekeeper who has
 * been offline for a while, whose unsent Rounds get lost.
 */
function TakeOverSheet({
  scorekeeper,
  offlineSince,
  serverTime,
  pending,
  onConfirm,
  onClose,
}: {
  scorekeeper: string
  offlineSince: Date | null
  serverTime: Date
  pending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const now = useServerNow(serverTime, false)
  const since = offlineSince
    ? `${scorekeeper} ist seit ${formatOfflineForLong(now.getTime() - offlineSince.getTime())} offline. `
    : ""
  return (
    <GameSheet onClose={onClose} pending={pending}>
      <DrawerHeader>
        <DrawerTitle tone="warning">
          <TriangleAlert />
          Zählen übernehmen?
        </DrawerTitle>
        <DrawerDescription>
          {since}Runden, die {scorekeeper} in dieser Zeit gezählt und noch nicht
          gesendet hat, gehen verloren.
        </DrawerDescription>
      </DrawerHeader>
      <DrawerFooter>
        <Button size="xl" onClick={onConfirm} disabled={pending}>
          Trotzdem übernehmen
        </Button>
        <DrawerClose
          render={<Button variant="secondary" size="xl" />}
          disabled={pending}
        >
          Abbrechen
        </DrawerClose>
      </DrawerFooter>
    </GameSheet>
  )
}

/** A warning with one way on, "Verstanden". */
function NoticeSheet({
  title,
  onClose,
  children,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  return (
    <GameSheet onClose={onClose}>
      <DrawerHeader>
        <DrawerTitle tone="warning">
          <TriangleAlert />
          {title}
        </DrawerTitle>
        <DrawerDescription>{children}</DrawerDescription>
      </DrawerHeader>
      <DrawerFooter>
        <DrawerClose render={<Button size="xl" />}>Verstanden</DrawerClose>
      </DrawerFooter>
    </GameSheet>
  )
}

/**
 * Rounds counted on this device that the server refused (after being
 * offline, say), told plainly: what happened, that they are gone, and to
 * check the table. "Carla zählt jetzt" covers a takeover.
 */
function DiscardedSheet({
  reason,
  discarded,
  onClose,
}: {
  reason: string
  discarded: number
  onClose: () => void
}) {
  return (
    <NoticeSheet title="Runden nicht gespeichert" onClose={onClose}>
      {reason} {describeDiscarded(discarded)} Gleicht den Stand am Tisch ab,
      angezeigt wird jetzt der gespeicherte Stand.
    </NoticeSheet>
  )
}

/** "Deine 2 nicht gesendeten Runden wurden verworfen." */
function describeDiscarded(rounds: number) {
  if (rounds === 0) return "Deine nicht gesendeten Änderungen wurden verworfen."
  if (rounds === 1) return "Deine nicht gesendete Runde wurde verworfen."
  return `Deine ${rounds} nicht gesendeten Runden wurden verworfen.`
}

/** "Carla zählt jetzt": told once on the device someone took over from. */
function ReplacedSheet({
  by,
  offline,
  discarded,
  onClose,
}: {
  by: string
  offline: boolean
  discarded: number
  onClose: () => void
}) {
  const what = offline
    ? `Du warst offline, als ${by} übernommen hat.`
    : `${by} hat das Zählen übernommen.`
  const lost =
    discarded === 0
      ? " Du kannst das Zählen jederzeit wieder übernehmen."
      : ` ${describeDiscarded(discarded)} Gleicht den Stand am Tisch ab, angezeigt wird jetzt der gespeicherte Stand.`
  return (
    <NoticeSheet title={`${by} zählt jetzt`} onClose={onClose}>
      {what + lost}
    </NoticeSheet>
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
    <GameSheet onClose={onClose}>
      <DrawerHeader>
        <DrawerTitle>Zuschauer einladen</DrawerTitle>
        <DrawerDescription>
          Wer den Code scannt, sieht das Spiel live, auch ohne Konto. Der Link
          gilt nur, solange das Spiel läuft.
        </DrawerDescription>
      </DrawerHeader>
      <QrCard size="sm">
        {link.url ? (
          <QrCode text={link.url} label="QR-Code des Zuschauer-Links" />
        ) : null}
      </QrCard>
      <LinkField
        label="Zuschauer-Link"
        shownUrl={link.shownUrl}
        copied={link.copied}
        onCopy={link.copy}
      />
      <FieldError>{link.error}</FieldError>
      <DrawerFooter orientation="horizontal">
        <DrawerClose render={<Button variant="secondary" size="lg" />}>
          Fertig
        </DrawerClose>
        <Button size="lg" onClick={link.share} disabled={!link.url}>
          Link teilen
        </Button>
      </DrawerFooter>
    </GameSheet>
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
  return (
    <GameSheet onClose={onClose}>
      <DrawerHeader>
        <DrawerTitle>Spiel</DrawerTitle>
      </DrawerHeader>
      <ItemGroup className="gap-0">
        <MenuItem
          icon={<History />}
          render={<Link to="/games/$gameId/history" params={{ gameId }} />}
        >
          Spielverlauf
        </MenuItem>
        {onSpectators ? (
          <MenuItem icon={<QrCodeIcon />} onClick={onSpectators}>
            Zuschauer einladen
          </MenuItem>
        ) : null}
        <Item variant="row" size="menu" render={<label />}>
          <ItemMedia>
            <EyeOff />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Ausgeschiedene ausblenden</ItemTitle>
          </ItemContent>
          <Switch checked={hideOut} onCheckedChange={onHideOut} />
        </Item>
        {onCancel ? (
          <MenuItem icon={<CircleX />} tone="destructive" onClick={onCancel}>
            Spiel abbrechen
          </MenuItem>
        ) : null}
      </ItemGroup>
      <DrawerFooter>
        <DrawerClose render={<Button variant="secondary" size="lg" />}>
          Schließen
        </DrawerClose>
      </DrawerFooter>
    </GameSheet>
  )
}

/** One line of the Game's menu: a link via `render`, or a button with `onClick`. */
function MenuItem({
  icon,
  tone,
  render,
  onClick,
  children,
}: {
  icon: ReactNode
  tone?: "destructive"
  render?: React.ReactElement
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <Item
      variant="row"
      size="menu"
      tone={tone}
      render={render ?? <ItemButton onClick={onClick} />}
    >
      <ItemMedia>{icon}</ItemMedia>
      <ItemContent>
        <ItemTitle>{children}</ItemTitle>
      </ItemContent>
    </Item>
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

function Cancelled({ game, viewerId }: { game: GameView; viewerId: string }) {
  // Steps still queued for a cancelled Game can never be taken.
  useEffect(() => stepQueue(game.id, viewerId).clear(), [game.id, viewerId])
  return (
    <Page>
      <PageHeader>
        <BackToGroup groupId={game.groupId} />
        <PageHeaderTitle>Spiel abgebrochen</PageHeaderTitle>
        <HistoryLink gameId={game.id} />
      </PageHeader>
      <SectionDescription className="px-6 pt-6">
        Dieses Spiel wurde abgebrochen und zählt in keiner Statistik.
      </SectionDescription>
    </Page>
  )
}
