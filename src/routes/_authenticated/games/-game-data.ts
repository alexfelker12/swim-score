import { useMutation, useQueryClient } from "@tanstack/react-query"
import { preview } from "@/rules-engine"
import { gameQuery, groupChanged, mutationKeys } from "@/lib/queries"
import { recordEventFn } from "@/server/functions"
import type { GameEvent } from "@/rules-engine"
import type { GameView } from "@/server/games"

/** Identifies the Scorekeeper's recordings of one Game. */
export const recordingKey = mutationKeys.recordEvent

/** The server refused an Event; `code` says why. */
export class RecordRefused extends Error {
  constructor(readonly code: string) {
    super(`Event refused: ${code}`)
  }
}

/**
 * Records Events for the Scorekeeper. An Event shows at once ("optimistic"),
 * and the recordings reach the server one after another in the order tapped,
 * each on top of the version the one before it produced. When one is refused,
 * the ones after it are too, and once the last has come back the Game is
 * loaded again, so the screen shows what the server has.
 *
 * `record(event, { optimistic: false })` waits for the server instead; used
 * for the Event that ends the Game, which shows a different screen.
 */
export function useRecordEvent(
  gameId: string,
  { onRefused }: { onRefused: (code: string) => void }
) {
  const queryClient = useQueryClient()
  const { queryKey } = gameQuery(gameId)
  const mutation = useMutation({
    mutationKey: recordingKey(gameId),
    // Same scope: one recording at a time, in the order they were made.
    scope: { id: `record-event-${gameId}` },
    mutationFn: async (variables: {
      event: GameEvent
      expectedVersion: number
      optimistic: boolean
    }) => {
      const result = await recordEventFn({
        data: {
          gameId,
          expectedVersion: variables.expectedVersion,
          event: variables.event,
        },
      })
      if (!result.ok) throw new RecordRefused(result.code)
      return result.value
    },
    onMutate: async ({ event, optimistic }) => {
      if (!optimistic) return
      // A fetch still on its way would overwrite the Event shown here.
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData(queryKey, (game) =>
        game ? withEvent(game, event) : game
      )
    },
    onError: (error) => {
      onRefused(error instanceof RecordRefused ? error.code : "network")
    },
    onSettled: async () => {
      // Load again only after the last recording, or the screen would jump
      // back to a state without the Events still on their way.
      if (queryClient.isMutating({ mutationKey: recordingKey(gameId) }) !== 1) {
        return
      }
      const groupId = queryClient.getQueryData(queryKey)?.groupId
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        // Round, Winner and Swimmer in the Game list and the next
        // preselection; they load when shown next.
        groupId === undefined
          ? null
          : groupChanged(queryClient, groupId, { later: true }),
      ])
    },
  })

  return {
    record: (event: GameEvent, { optimistic = true } = {}) => {
      // The version as shown, including Events still on their way.
      const shown = queryClient.getQueryData(queryKey)
      if (!shown) return Promise.resolve()
      return mutation
        .mutateAsync({ event, expectedVersion: shown.version, optimistic })
        .then(
          () => undefined,
          () => undefined
        )
    },
    /** True while the Event that ends the Game is on its way. */
    finishing: mutation.isPending && mutation.variables.optimistic === false,
  }
}

/** The Game as it will be once the server has recorded the Event. */
function withEvent(game: GameView, event: GameEvent): GameView {
  const result = preview(game.state, game.ruleSet, event)
  if (!result.ok) return game
  return {
    ...game,
    version: game.version + 1,
    events: [...game.events, event],
    state: result.state,
  }
}
