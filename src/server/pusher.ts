import Pusher from "pusher"
import { GAME_CHANGED, gameChannel } from "@/lib/live"
import type { GameChangedMessage } from "@/lib/live"
import type { Notifier } from "./app"

export type PusherConfig = {
  appId: string
  key: string
  secret: string
  cluster: string
}

/** Sends "Game changed, version N" on the Game's Pusher channel. */
export function pusherNotifier(config: PusherConfig): Notifier {
  const pusher = new Pusher({ ...config, useTLS: true })
  return {
    gameChanged: async (gameId, version) => {
      const message: GameChangedMessage = { version }
      await pusher.trigger(gameChannel(gameId), GAME_CHANGED, message)
    },
  }
}

/** For running without Pusher (local development): nobody is told, devices see changes when they load again. */
export const silentNotifier: Notifier = {
  gameChanged: async () => {},
}
