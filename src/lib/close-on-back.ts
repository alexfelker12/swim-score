import { useEffect, useId, useRef, useState } from "react"

// "Zurück" closes the topmost open Drawer or Dialog instead of leaving the
// page (#54, ADR 0013): the Android back button and gesture, and on iOS the
// swipe from the left edge, which goes back in the browser history.
//
// Every open sheet gets an entry of its own in the history, without a new
// URL. The router must not see these entries: it treats every change of the
// history as a navigation and would run the root route again. So entries are
// pushed with the browser's own `pushState` (the router replaces it with one
// that tells the router), and this module's `popstate` listener runs before
// the router's and keeps the sheets' steps from it. Both need
// `listenBeforeRouter()` to run before the router is created.

/** Marks a sheet's history entry with the id of that opening. */
const marker = "__swimScoreSheet"

type Sheet = {
  id: string
  /** The page the sheet opened on. */
  href: string
  close: () => void
}

/** Open sheets in the order they opened; the last one is on top. */
const stack: Array<Sheet> = []
/** `popstate` events of our own `back()` calls, kept from the router. */
let ownPops = 0
/**
 * Sheets that opened while our own `back()` was still on its way (one sheet
 * replacing another): their entry is pushed once it arrived, or the step
 * back would take the new entry instead of the old.
 */
const waitingToPush: Array<string> = []
let browserPushState: History["pushState"] | null = null
let openings = 0

/**
 * Starts listening to the history. Must run before the router is created:
 * the router replaces `pushState` and adds its own `popstate` listener,
 * which must come after this one.
 */
export function listenBeforeRouter() {
  if (typeof window === "undefined" || browserPushState) return
  browserPushState = window.history.pushState.bind(window.history)
  // Reloaded on a sheet's entry: the sheet is gone, so is its mark.
  const state: unknown = window.history.state
  if (sheetOf(state) !== undefined) {
    const rest = { ...(state as Record<string, unknown>) }
    delete rest[marker]
    window.history.replaceState(rest, "")
  }
  window.addEventListener("popstate", onPopState)
}

function sheetOf(state: unknown): string | undefined {
  return typeof state === "object" && state !== null
    ? (state as Record<string, string | undefined>)[marker]
    : undefined
}

function isOpen(id: string) {
  return stack.some((sheet) => sheet.id === id)
}

function pushEntry(id: string) {
  if (ownPops > 0) {
    waitingToPush.push(id)
    return
  }
  const state: unknown = window.history.state
  browserPushState?.({ ...(state as object | null), [marker]: id }, "")
}

function onPopState(event: PopStateEvent) {
  if (ownPops > 0) {
    ownPops--
    event.stopImmediatePropagation()
    if (ownPops === 0) {
      for (const id of waitingToPush.splice(0)) {
        if (isOpen(id)) pushEntry(id)
      }
    }
    return
  }
  const entrySheet = sheetOf(window.history.state)
  const top = stack.at(-1)
  // Chrome skips entries pushed without a tap on the page (a sheet that
  // opened on its own): then "Zurück" lands on another page, which is the
  // router's to show; the sheet goes with its page.
  if (top && entrySheet !== top.id && window.location.href === top.href) {
    // Back from the topmost sheet's entry: close the sheet, not the page.
    // The entry comes back at once and goes again when the sheet has closed
    // (the effect's cleanup): a sheet busy with an action stays open
    // (useSheet), and a second "Zurück" right away must not leave the page.
    event.stopImmediatePropagation()
    pushEntry(top.id)
    top.close()
    return
  }
  if (entrySheet !== undefined && !isOpen(entrySheet)) {
    // The entry of a sheet that closed while a page was opened from it:
    // step over it.
    event.stopImmediatePropagation()
    window.history.back()
  }
}

/**
 * Gives an open sheet its own history entry, so "Zurück" calls `close`.
 * Closing it any other way removes the entry again, unless a page was
 * opened in the meantime (then the entry is stepped over later).
 */
function useCloseOnBack(open: boolean, close: () => void) {
  const component = useId()
  const latestClose = useRef(close)
  latestClose.current = close

  useEffect(() => {
    if (!open) return
    // An id per opening: an entry left from an earlier opening never counts
    // as this one's.
    const id = `${component}${++openings}`
    const sheet: Sheet = {
      id,
      href: window.location.href,
      close: () => latestClose.current(),
    }
    stack.push(sheet)
    pushEntry(id)
    return () => {
      stack.splice(stack.indexOf(sheet), 1)
      const waiting = waitingToPush.indexOf(id)
      if (waiting !== -1) waitingToPush.splice(waiting, 1)
      if (sheetOf(window.history.state) === id) {
        ownPops++
        window.history.back()
      }
    }
  }, [open, component])
}

/** What `Drawer` and `Dialog` pass on to Base UI's root. */
type RootProps<TDetails, TActions> = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean, details: TDetails) => void
  actionsRef?: React.RefObject<TActions | null>
}

/**
 * The root props of a Drawer or Dialog that "Zurück" closes, through Base
 * UI's own `close()`: the same way as every other way of closing, so a
 * pending action can keep it open.
 */
export function useClosedByBack<
  TDetails,
  TActions extends { close: () => void },
>({
  open,
  defaultOpen = false,
  onOpenChange,
  actionsRef,
}: RootProps<TDetails, TActions>) {
  // Only used when the caller doesn't control `open`.
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const ownActions = useRef<TActions>(null)
  const actions = actionsRef ?? ownActions
  useCloseOnBack(open ?? uncontrolledOpen, () => actions.current?.close())
  return {
    open,
    defaultOpen,
    onOpenChange: (next: boolean, details: TDetails) => {
      setUncontrolledOpen(next)
      onOpenChange?.(next, details)
    },
    actionsRef: actions,
  }
}
