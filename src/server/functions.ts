import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { CommandError } from "./errors"
import { getApp } from "./instance"
import { getProfile, setAvatar, setTheme, updateProfile } from "./profile"
import type { Theme } from "./profile"

// Thin adapters from TanStack Start server functions to the server commands.
// Each command checks the session itself.

function headers(): Headers {
  return new Headers(getRequestHeaders())
}

export type Outcome = { ok: true } | { ok: false; code: string }

/** Runs a command and hands a refusal to the client as a value, not a thrown error. */
async function outcome(run: () => Promise<void>): Promise<Outcome> {
  try {
    await run()
    return { ok: true }
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

export const setAvatarFn = createServerFn({ method: "POST" })
  .validator((input: FormData) => {
    const file = input.get("image")
    if (!(file instanceof File)) throw new Error("image is missing")
    return file
  })
  .handler(({ data }) =>
    outcome(async () =>
      setAvatar(getApp(), headers(), {
        data: new Uint8Array(await data.arrayBuffer()),
      })
    )
  )
