import Pusher from "pusher"
import {
  GAME_CHANGED,
  PRESENCE_CHANGED,
  gameChannel,
  gameOfPresenceChannel,
} from "@/lib/live"
import type { GameChangedMessage } from "@/lib/live"
import type { Notifier } from "./app"

export type PusherConfig = {
  appId: string
  key: string
  secret: string
  cluster: string
}

export function createPusher(config: PusherConfig): Pusher {
  return new Pusher({ ...config, useTLS: true })
}

/** Sends "Game changed" and "presence changed" on the Game's Pusher channel. */
export function pusherNotifier(pusher: Pusher): Notifier {
  return {
    gameChanged: async (gameId, version) => {
      const message: GameChangedMessage = { version }
      await pusher.trigger(gameChannel(gameId), GAME_CHANGED, message)
    },
    scorekeeperPresenceChanged: async (gameId) => {
      await pusher.trigger(gameChannel(gameId), PRESENCE_CHANGED, {})
    },
  }
}

/** For running without Pusher (local development): nobody is told, devices see changes when they load again. */
export const silentNotifier: Notifier = {
  gameChanged: async () => {},
  scorekeeperPresenceChanged: async () => {},
}

/** A device of `userId` opened (connected) or left a Game's presence channel. */
export type PresenceReport = {
  gameId: string
  userId: string
  connected: boolean
  at: Date
}

/**
 * The presence reports in a Pusher webhook, or null when its signature does
 * not match (not from Pusher). Events of other channels are left out.
 */
export function readPresenceWebhook(
  pusher: Pusher,
  headers: Headers,
  rawBody: string
): Array<PresenceReport> | null {
  const webhook = pusher.webhook({
    headers: Object.fromEntries(headers),
    rawBody,
  })
  if (!webhook.isValid()) return null
  const at = webhook.getTime()
  return webhook.getEvents().flatMap((event) => {
    const gameId = gameOfPresenceChannel(event.channel)
    const connected =
      event.name === "member_added"
        ? true
        : event.name === "member_removed"
          ? false
          : null
    // Presence events carry the member; the SDK's types leave it out.
    const userId = (event as { user_id?: string }).user_id
    if (!gameId || connected === null || !userId) return []
    return [{ gameId, userId, connected, at }]
  })
}
