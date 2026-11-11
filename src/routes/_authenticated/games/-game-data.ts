import { useMutation, useQueryClient } from "@tanstack/react-query"
import { preview, replay } from "@/rules-engine"
import { gameQuery, groupChanged, mutationKeys } from "@/lib/queries"
import {
  addTiebreakFn,
  cancelGameFn,
  recordEventFn,
  undoEventFn,
} from "@/server/functions"
import type { GameEvent } from "@/rules-engine"
import type { GameView } from "@/server/games"

/** Identifies the Scorekeeper's steps on one Game, including cancelling. */
export const stepsKey = mutationKeys.gameSteps

/** The server refused a step; `code` says why. */
export class StepRefused extends Error {
  constructor(readonly code: string) {
    super(`Step refused: ${code}`)
  }
}

/**
 * One step of the Scorekeeper: record an Event, undo the last one, or add the
 * Tiebreak to the last loss.
 */
type StepInput = (
  | { kind: "record"; event: GameEvent }
  | { kind: "undo" }
  | { kind: "tiebreak"; tiebreak: Array<string> }
) & {
  optimistic: boolean
}

type Step = StepInput & { expectedVersion: number }

/**
 * The Scorekeeper's steps on one Game: recording Events, undoing them and
 * adding a Tiebreak to the last loss.
 * A step shows at once ("optimistic"), and the steps reach the server one
 * after another in the order tapped, each on top of the version the one
 * before it produced. When one is refused, the ones after it are too, and
 * once the last has come back the Game is loaded again, so the screen shows
 * what the server has.
 *
 * `{ optimistic: false }` waits for the server instead; used for the Event
 * that ends the Game and for undoing that end, which change the screen.
 * `cancel` cancels the Game after the steps still on their way.
 */
export function useGameSteps(
  gameId: string,
  { onRefused }: { onRefused: (code: string) => void }
) {
  const queryClient = useQueryClient()
  const { queryKey } = gameQuery(gameId)
  const mutationKey = stepsKey(gameId)
  // Same scope: one step at a time, in the order they were made; cancelling
  // waits for them too.
  const scope = { id: mutationKey.join(":") }

  async function reload() {
    const groupId = queryClient.getQueryData(queryKey)?.groupId
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      // Round, Winner and Swimmer in the Game list and the next
      // preselection; they load when shown next.
      groupId === undefined
        ? null
        : groupChanged(queryClient, groupId, { later: true }),
    ])
  }

  const steps = useMutation({
    mutationKey,
    scope,
    mutationFn: async (step: Step) => {
      const { expectedVersion } = step
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
      if (!result.ok) throw new StepRefused(result.code)
      return result.value
    },
    onMutate: async (step) => {
      if (!step.optimistic) return
      // A fetch still on its way would overwrite the step shown here.
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData(queryKey, (game) =>
        game ? applyStep(game, step) : game
      )
    },
    onError: (error) => {
      onRefused(error instanceof StepRefused ? error.code : "network")
    },
    onSettled: async () => {
      // Load again only after the last step, or the screen would jump back
      // to a state without the steps still on their way.
      if (queryClient.isMutating({ mutationKey }) === 1) {
        await reload()
      }
    },
  })

  const cancelling = useMutation({
    mutationKey,
    scope,
    mutationFn: async () => {
      const result = await cancelGameFn({ data: { gameId } })
      if (!result.ok) throw new StepRefused(result.code)
    },
    onSettled: reload,
  })

  function run(step: StepInput) {
    // The version as shown, including steps still on their way.
    const shown = queryClient.getQueryData(queryKey)
    if (!shown) return Promise.resolve()
    return steps.mutateAsync({ ...step, expectedVersion: shown.version }).then(
      () => undefined,
      () => undefined
    )
  }

  return {
    record: (event: GameEvent, { optimistic = true } = {}) =>
      run({ kind: "record", event, optimistic }),
    undo: ({ optimistic = true } = {}) => run({ kind: "undo", optimistic }),
    /** Adds the Tiebreak, the loser included, to the last loss. */
    addTiebreak: (tiebreak: Array<string>) =>
      run({ kind: "tiebreak", tiebreak, optimistic: true }),
    /** Resolves with the reason when the server refuses, or nothing. */
    cancel: () =>
      cancelling.mutateAsync().then(
        () => undefined,
        (error: unknown) =>
          error instanceof StepRefused ? error.code : "network"
      ),
    /** True while a step that changes the screen is on its way. */
    waiting: steps.isPending && steps.variables.optimistic === false,
  }
}

/** The Game as it will be once the server has taken the step. */
function applyStep(game: GameView, step: Step): GameView {
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
