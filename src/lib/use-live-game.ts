import { useEffect, useRef } from "react"
import { GAME_CHANGED, gameChannel } from "@/lib/live"
import type Pusher from "pusher-js"
import type { GameChangedMessage } from "@/lib/live"

const key = import.meta.env.VITE_PUSHER_KEY as string | undefined
const cluster = import.meta.env.VITE_PUSHER_CLUSTER as string | undefined

/** Whether Games are shown live here; without Pusher they are not. */
export const liveUpdates = Boolean(key && cluster)

let client: Promise<Pusher> | undefined

/** One Pusher connection per page. */
function pusher(): Promise<Pusher> {
  client ??= import("pusher-js").then(
    ({ default: PusherClient }) => new PusherClient(key!, { cluster: cluster! })
  )
  return client
}

/**
 * Keeps a Game on screen current (ADR 0005): `onChange` loads it again (a
 * named reload from `queries.ts`) when the server says the Game changed to a
 * version newer than `version`, once listening has started (changes before
 * that would be missed) and after a lost connection is back. `isBusy` holds
 * that back while the viewer's own steps are on their way; those load the
 * Game again themselves when done. Nothing happens for a null `gameId`.
 */
export function useLiveGame({
  gameId,
  version,
  onChange,
  isBusy = () => false,
}: {
  gameId: string | null
  /** The version shown now; null when no Game is shown. */
  version: number | null
  onChange: () => void
  isBusy?: () => boolean
}) {
  // The handlers read the latest values without subscribing again.
  const latest = useRef({ version, onChange, isBusy })
  latest.current = { version, onChange, isBusy }

  useEffect(() => {
    if (!liveUpdates || gameId === null) return
    let stopped = false
    let stop = () => {}
    const reload = () => {
      if (!latest.current.isBusy()) latest.current.onChange()
    }
    void pusher().then((connection) => {
      if (stopped) return
      const name = gameChannel(gameId)
      const channel = connection.subscribe(name)
      const onChanged = (message: GameChangedMessage) => {
        const shown = latest.current.version
        if (shown === null || message.version > shown) reload()
      }
      // Messages sent while the connection was lost are gone: load again
      // once it is back.
      let lost = false
      const onState = ({
        previous,
        current,
      }: {
        previous: string
        current: string
      }) => {
        if (previous === "connected" && current !== "connected") lost = true
        if (current === "connected" && lost) {
          lost = false
          reload()
        }
      }
      channel.bind("pusher:subscription_succeeded", reload)
      channel.bind(GAME_CHANGED, onChanged)
      connection.connection.bind("state_change", onState)
      stop = () => {
        channel.unbind("pusher:subscription_succeeded", reload)
        channel.unbind(GAME_CHANGED, onChanged)
        connection.connection.unbind("state_change", onState)
        connection.unsubscribe(name)
      }
    })
    return () => {
      stopped = true
      stop()
    }
  }, [gameId])
}
