import { getGame, recordEvent, startGame } from "../games"
import type { App } from "../app"

/** Plays a Game of two to the end: `winner` beats `loser`, who swims before going Out. */
export async function playGame(
  app: App,
  headers: Headers,
  groupId: string,
  [winner, loser]: [string, string]
) {
  const { id: gameId } = await startGame(app, headers, {
    groupId,
    playerIds: [winner, loser],
  })
  const { participants } = await getGame(app, headers, { gameId })
  // Three Lives, then once more as the Swimmer.
  for (let version = 0; version < 4; version++) {
    await recordEvent(app, headers, {
      gameId,
      expectedVersion: version,
      event: { type: "lost", loser: participants[1].id },
    })
  }
  return gameId
}
