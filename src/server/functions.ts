import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { CommandError } from "./errors"
import { addGuest, createGroup, getGroup, listMyGroups } from "./groups"
import { getGame, getNewGame, listGames, recordEvent, startGame } from "./games"
import { getApp } from "./instance"
import {
  getAvatarSource,
  getProfile,
  removeAvatar,
  setAvatar,
  setTheme,
  updateProfile,
} from "./profile"
import type { GameEvent } from "@/rules-engine"
import type { AvatarCrop, Theme } from "./profile"

// Thin adapters from TanStack Start server functions to the server commands.
// Each command checks the session itself.

function headers(): Headers {
  return new Headers(getRequestHeaders())
}

export type Outcome<T = undefined> =
  { ok: true; value: T } | { ok: false; code: string }

/** Runs a command and hands a refusal to the client as a value, not a thrown error. */
async function outcome<T>(run: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await run() }
  } catch (error) {
    if (error instanceof CommandError) return { ok: false, code: error.code }
    throw error
  }
}

/** The signed-in account for routing and theming, or null. */
export const getViewer = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getApp().auth.api.getSession({ headers: headers() })
  if (!session) return null
  const { id, name, image, theme } = session.user
  return { id, name, image: image ?? null, theme: theme as Theme }
})

export const getProfileFn = createServerFn({ method: "GET" }).handler(() =>
  getProfile(getApp(), headers())
)

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator((input: { name: string; email: string }) => input)
  .handler(({ data }) =>
    outcome(() => updateProfile(getApp(), headers(), data))
  )

export const setThemeFn = createServerFn({ method: "POST" })
  .validator((input: { theme: Theme }) => input)
  .handler(({ data }) => outcome(() => setTheme(getApp(), headers(), data)))

/** FormData: `avatar` and `source` as files, `crop` as JSON. */
export const setAvatarFn = createServerFn({ method: "POST" })
  .validator((input: FormData) => {
    const avatar = input.get("avatar")
    const source = input.get("source")
    const crop = input.get("crop")
    if (
      !(avatar instanceof File) ||
      !(source instanceof File) ||
      typeof crop !== "string"
    ) {
      throw new Error("avatar, source and crop are required")
    }
    // The command checks the crop's shape; malformed JSON becomes no crop.
    return { avatar, source, crop: parseJson(crop) as AvatarCrop }
  })
  .handler(({ data }) =>
    outcome(async () =>
      setAvatar(getApp(), headers(), {
        avatar: new Uint8Array(await data.avatar.arrayBuffer()),
        source: new Uint8Array(await data.source.arrayBuffer()),
        crop: data.crop,
      })
    )
  )

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Where the picture editor starts: an image URL (data URL or Google's) and the crop. */
export const getAvatarSourceFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await getAvatarSource(getApp(), headers())
    if (!result) return null
    const { source, crop } = result
    const src =
      "url" in source
        ? source.url
        : `data:${source.contentType};base64,${Buffer.from(source.data).toString("base64")}`
    return { src, crop }
  }
)

export const removeAvatarFn = createServerFn({ method: "POST" }).handler(() =>
  outcome(() => removeAvatar(getApp(), headers()))
)

export const createGroupFn = createServerFn({ method: "POST" })
  .validator((input: { name: string }) => input)
  .handler(({ data }) => outcome(() => createGroup(getApp(), headers(), data)))

/** The Group, or null when it does not exist or the viewer is not its Player. */
export const getGroupFn = createServerFn({ method: "GET" })
  .validator((input: { groupId: string }) => input)
  .handler(async ({ data }) => {
    const result = await outcome(() => getGroup(getApp(), headers(), data))
    return result.ok ? result.value : null
  })

export const addGuestFn = createServerFn({ method: "POST" })
  .validator((input: { groupId: string; name: string }) => input)
  .handler(({ data }) => outcome(() => addGuest(getApp(), headers(), data)))

export const listMyGroupsFn = createServerFn({ method: "GET" }).handler(() =>
  listMyGroups(getApp(), headers())
)

/** "Spiel starten": the Group's Players and the last Seating Order, or null. */
export const getNewGameFn = createServerFn({ method: "GET" })
  .validator((input: { groupId: string }) => input)
  .handler(async ({ data }) => {
    const result = await outcome(() => getNewGame(getApp(), headers(), data))
    return result.ok ? result.value : null
  })

export const startGameFn = createServerFn({ method: "POST" })
  .validator((input: { groupId: string; playerIds: Array<string> }) => input)
  .handler(({ data }) => outcome(() => startGame(getApp(), headers(), data)))

/** The Game, or null when it does not exist or the viewer is not in its Group. */
export const getGameFn = createServerFn({ method: "GET" })
  .validator((input: { gameId: string }) => input)
  .handler(async ({ data }) => {
    const result = await outcome(() => getGame(getApp(), headers(), data))
    return result.ok ? result.value : null
  })

export const recordEventFn = createServerFn({ method: "POST" })
  .validator(
    (input: { gameId: string; expectedVersion: number; event: GameEvent }) =>
      input
  )
  .handler(({ data }) => outcome(() => recordEvent(getApp(), headers(), data)))

/** The Group's Games, or none when the viewer is not its Player. */
export const listGamesFn = createServerFn({ method: "GET" })
  .validator((input: { groupId: string }) => input)
  .handler(async ({ data }) => {
    const result = await outcome(() => listGames(getApp(), headers(), data))
    return result.ok ? result.value : []
  })
