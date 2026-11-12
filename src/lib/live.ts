// The Pusher channel and event that carry "Game changed" (ADR 0005), the
// same on the server that sends and the browser that listens.

/**
 * One public channel per Game. It carries nothing but the version number;
 * the Game itself is only ever loaded through the server, with its checks.
 */
export function gameChannel(gameId: string): string {
  return `game-${gameId}`
}

export const GAME_CHANGED = "changed"

export type GameChangedMessage = { version: number }

/**
 * Sent on the Game's channel when its Scorekeeper's device connects or goes
 * offline; the version stays, so devices load the Game again regardless.
 */
export const PRESENCE_CHANGED = "presence"

const PRESENCE_PREFIX = "presence-game-"

/**
 * The Pusher presence channel of a Game: every Participant with an account
 * who has it open is a member (ADR 0003), so the server learns, via Pusher's
 * webhooks, whether the Scorekeeper is connected.
 */
export function presenceChannel(gameId: string): string {
  return PRESENCE_PREFIX + gameId
}

/** The Game behind a presence channel's name; null for any other channel. */
export function gameOfPresenceChannel(channel: string): string | null {
  return channel.startsWith(PRESENCE_PREFIX)
    ? channel.slice(PRESENCE_PREFIX.length) || null
    : null
}
