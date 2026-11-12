import { useEffect, useRef, useSyncExternalStore } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { preview, replay } from "@/rules-engine"
import {
  gameChanged,
  gameQuery,
  groupChanged,
  mutationKeys,
} from "@/lib/queries"
import {
  addTiebreakFn,
  cancelGameFn,
  getGameFn,
  recordEventFn,
  takeOverFn,
  undoEventFn,
} from "@/server/functions"
import type { GameEvent } from "@/rules-engine"
import type { GameView } from "@/server/games"
import { emptyQueue, stepQueue } from "./-step-queue"
import type { QueueState, QueuedStep, Refusal, SendResult } from "./-step-queue"

/** Identifies cancelling a Game; the steps themselves go through `stepQueue`. */
export const cancelKey = mutationKeys.cancelGame

/** The server refused a step; `code` says why. */
export class StepRefused extends Error {
  constructor(readonly code: string) {
    super(`Step refused: ${code}`)
  }
}

/** The Scorekeeper's queue of one Game, for showing it. */
export function useStepQueue(gameId: string, viewerId: string): QueueState {
  const queue = stepQueue(gameId, viewerId)
  return useSyncExternalStore(queue.subscribe, queue.get, () => emptyQueue)
}

/**
 * The Game as shown: what the server has, plus the steps not sent yet
 * (ADR 0007), applied through the rules engine. Steps the server already
 * has (it is past the queue's base) are not applied twice.
 */
export function withQueuedSteps(game: GameView, queue: QueueState): GameView {
  const taken = Math.max(0, game.version - queue.baseVersion)
  return queue.steps
    .slice(taken)
    .filter((step) => step.optimistic)
    .reduce(applyStep, game)
}

/**
 * The Scorekeeper's steps on one Game: recording Events, undoing them and
 * adding a Tiebreak to the last loss.
 * A step shows at once and waits in the Game's queue (`stepQueue`), which
 * survives a reload and sends the steps one after another in the order
 * tapped, each on top of the version the one before produced; without a
 * connection it keeps them and tries again. Undoing a step not sent yet
 * just drops it. When the server refuses one, it and all after it are
 * dropped (`onRefused`), and the Game is loaded again, so the screen shows
 * what the server has.
 *
 * `{ optimistic: false }` waits for the server instead; used for the Event
 * that ends the Game and for undoing that end, which change the screen.
 * `cancel` cancels the Game once the queue is sent.
 */
export function useGameSteps(
  gameId: string,
  viewerId: string,
  { onRefused }: { onRefused: (refusal: Refusal) => void }
) {
  const queryClient = useQueryClient()
  const { queryKey } = gameQuery(gameId)
  const queue = stepQueue(gameId, viewerId)
  const state = useStepQueue(gameId, viewerId)
  // The handlers read the latest callback without attaching again.
  const latest = useRef(onRefused)
  latest.current = onRefused

  useEffect(() => {
    const reload = () => {
      const groupId = queryClient.getQueryData(queryKey)?.groupId
      return Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        // Round, Winner and Swimmer in the Game list and the next
        // preselection; they load when shown next.
        groupId === undefined
          ? null
          : groupChanged(queryClient, groupId, { later: true }),
      ])
    }
    return queue.attach({
      send: (step, expectedVersion) => sendStep(gameId, step, expectedVersion),
      read: async () => {
        const result = await getGameFn({ data: { gameId } })
        return result ?? null
      },
      confirmed: (step, expectedVersion, version) => {
        // What the server has now, so the rest of the queue shows on top
        // of it; a fetch still on its way would show an older state.
        void queryClient.cancelQueries({ queryKey })
        if (!step.optimistic) return
        queryClient.setQueryData(queryKey, (game) => {
          if (game?.version !== expectedVersion) return game
          const next = applyStep(game, step)
          return next === game ? game : { ...next, version }
        })
      },
      refused: (refusal) => latest.current(refusal),
      drained: () => void reload(),
    })
    // queryKey is the same as long as gameId is.
  }, [queue, gameId, queryClient])

  const cancelling = useMutation({
    mutationKey: cancelKey(gameId),
    // Not paused without a connection: it says so instead.
    networkMode: "always",
    mutationFn: async () => {
      // Cancelling comes after everything counted so far.
      if (!(await queue.sent())) throw new StepRefused("offline")
      const result = await cancelGameFn({ data: { gameId } })
      if (!result.ok) throw new StepRefused(result.code)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  /** The server's version a step goes on top of when nothing is queued. */
  function serverVersion() {
    // A fetch landing now would show a state without the new step.
    void queryClient.cancelQueries({ queryKey })
    return queryClient.getQueryData(queryKey)?.version ?? 0
  }

  return {
    record: (event: GameEvent, { optimistic = true } = {}) =>
      queue.push({ kind: "record", event, optimistic }, serverVersion()),
    undo: ({ optimistic = true } = {}) =>
      queue.undo(serverVersion(), optimistic),
    /** Adds the Tiebreak, the loser included, to the last loss. */
    addTiebreak: (tiebreak: Array<string>) =>
      queue.push(
        { kind: "tiebreak", tiebreak, optimistic: true },
        serverVersion()
      ),
    /** Takes back the end of the Game if it has not left this device. */
    dropUnsentEnd: () => queue.dropUnsentEnd(),
    /** Resolves with the reason when the server refuses, or nothing. */
    cancel: () =>
      cancelling.mutateAsync().then(
        () => undefined,
        (error: unknown) =>
          error instanceof StepRefused ? error.code : "network"
      ),
    /** True while a step that changes the screen waits for the server. */
    waiting: state.steps.some((step) => !step.optimistic),
    /** The Events not taken by the server yet, while there is no connection. */
    unsentRounds: state.offline
      ? state.steps.filter((step) => step.kind === "record").length
      : null,
  }
}

/** One step to the server; throws when it cannot be reached. */
async function sendStep(
  gameId: string,
  step: QueuedStep,
  expectedVersion: number
): Promise<SendResult> {
  const result =
    step.kind === "record"
      ? await recordEventFn({
          data: { gameId, expectedVersion, event: step.event },
        })
      : step.kind === "tiebreak"
        ? await addTiebreakFn({
            data: { gameId, expectedVersion, tiebreak: step.tiebreak },
          })
        : await undoEventFn({ data: { gameId, expectedVersion } })
  return result.ok
    ? { ok: true, version: result.value.version }
    : { ok: false, code: result.code }
}

/** The Game as it will be once the server has taken the step. */
function applyStep(game: GameView, step: QueuedStep): GameView {
  if (step.kind === "undo") {
    if (game.events.length === 0) return game
    const events = game.events.slice(0, -1)
    return {
      ...game,
      // The revision counts every change, undoing included.
      version: game.version + 1,
      events,
      state: replay(
        game.ruleSet,
        game.participants.map((p) => p.id),
        events
      ),
    }
  }
  if (step.kind === "tiebreak") {
    const last = game.events.at(-1)
    if (last?.type !== "lost") return game
    // The Tiebreak only describes the loss; the state stays as it is.
    return {
      ...game,
      version: game.version + 1,
      events: [
        ...game.events.slice(0, -1),
        { ...last, tiebreak: step.tiebreak },
      ],
    }
  }
  const result = preview(game.state, game.ruleSet, step.event)
  if (!result.ok) return game
  return {
    ...game,
    version: game.version + 1,
    events: [...game.events, step.event],
    state: result.state,
  }
}

/**
 * Taking over as Scorekeeper. Resolves with the reason when the server
 * refuses (`takeoverNeedsConfirmation`: confirm the warning first), or
 * nothing; either way the Game is loaded again.
 */
export function useTakeOver(gameId: string, groupId: string) {
  const queryClient = useQueryClient()
  const takeOver = useMutation({
    // Not paused without a connection: it says so instead.
    networkMode: "always",
    mutationFn: async (confirmOffline: boolean) => {
      const result = await takeOverFn({ data: { gameId, confirmOffline } })
      if (!result.ok) throw new StepRefused(result.code)
    },
    onSettled: () => gameChanged(queryClient, gameId, groupId),
  })
  return {
    takeOver: ({ confirmOffline = false } = {}) =>
      takeOver.mutateAsync(confirmOffline).then(
        () => undefined,
        (error: unknown) =>
          error instanceof StepRefused ? error.code : "network"
      ),
    takingOver: takeOver.isPending,
  }
}
