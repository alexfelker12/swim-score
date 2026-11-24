import { orKept, rememberViewer, rememberedViewer } from "@/lib/kept-on-device"
import { getViewer } from "@/server/functions"
import type { Viewer } from "@/server/functions"

// The signed-in account (or null) for the root route's `beforeLoad`.
//
// On the server it is asked for every page. In the browser the account of
// the last page change stands in (#58): asking the server first would hold
// up every page change by a round trip. The server is asked alongside, and
// when its answer differs (signed out or renamed on another device) the
// router loads again with the new one, which sends a signed-out device to
// "Anmelden". Where the app itself changes the account (signing in and out,
// the profile), `reloadViewer` asks before the router loads again.

let known: Viewer | null | undefined
let asking: Promise<Viewer | null> | undefined
let onChange: (() => void) | undefined

/** For `beforeLoad`: the account, without a round trip once it is known. */
export async function loadViewer(): Promise<Viewer | null> {
  if (typeof window === "undefined") return getViewer()
  if (known === undefined) {
    known = await ask()
    return known
  }
  void check()
  return known
}

/**
 * The account a page loaded from the server brought along; it stands in
 * from the first page change on. Only an account, never null: the app shell
 * starts with null from the build (ADR 0012).
 */
export function keepViewer(viewer: Viewer | null) {
  if (!viewer) return
  rememberViewer(viewer)
  known ??= viewer
}

/** After the app changed the account: ask the server, then load again. */
export function reloadViewer(router: { invalidate: () => Promise<void> }) {
  known = undefined
  return router.invalidate()
}

/** What to do when the server's account differs from the one in use. */
export function onViewerChange(listener: () => void) {
  onChange = listener
}

/** The server's answer; without a connection the one kept on the device. */
function ask() {
  asking ??= orKept(async () => {
    const viewer = await getViewer()
    rememberViewer(viewer)
    return viewer
  }, rememberedViewer).finally(() => {
    asking = undefined
  })
  return asking
}

async function check() {
  if (asking) return
  const now = await ask().catch(() => known)
  if (now === undefined || JSON.stringify(now) === JSON.stringify(known)) {
    return
  }
  known = now
  onChange?.()
}
