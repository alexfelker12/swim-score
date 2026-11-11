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
