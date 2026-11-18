import { isIos } from "@/lib/platform"

// Page changes move like a stack (#55, ADR 0014): forward, the new page
// comes in from the right; back, the page goes out to the right. The
// router's view transitions with a type, "forward" or "back"; the slides
// are in src/styles.css.
//
// No transition when:
// - only the search changes (tabs of a page) or the page loads again;
// - the device asks for reduced motion;
// - the browser animates the step back itself (iOS swipe from the edge,
//   Android's back gesture), which would otherwise play twice;
// - the browser can't give a transition a type: it would cross-fade every
//   change, tabs included.

/** A location as the router hands it to `types`; only its state counts. */
type HistoryLocation = { state: unknown }

/**
 * The router's options for a view transition, written out: the router
 * doesn't export the type, and deriving it from the router's own types
 * would make them depend on themselves (this is part of the router).
 */
type ViewTransitionOptions = {
  types: (change: {
    fromLocation?: HistoryLocation
    toLocation: HistoryLocation
    pathChanged: boolean
  }) => Array<string> | false
}

/**
 * When the browser last animated a step back itself. Only counts for the
 * page change right after it: one that happens later (or none at all, e.g.
 * a step the router didn't turn into a transition) must not lose its own.
 */
let browserAnimatedAt = -Infinity
const sameStepMs = 1000

/**
 * Notes whether the browser animates a step back. Runs after the sheets'
 * listener (ADR 0013), so steps that only close a sheet don't count.
 */
export function listenForBrowserAnimations() {
  if (typeof window === "undefined") return
  const reported = "hasUAVisualTransition" in PopStateEvent.prototype
  window.addEventListener("popstate", (event) => {
    // Where the browser doesn't say, assume iOS animated its swipe.
    const animated = reported
      ? (event as PopStateEvent & { hasUAVisualTransition: boolean })
          .hasUAVisualTransition
      : isIos()
    browserAnimatedAt = animated ? performance.now() : -Infinity
  })
}

/** The router keeps the place in the history in its own state field. */
function historyIndex(location: HistoryLocation) {
  return (location.state as { __TSR_index?: number }).__TSR_index ?? 0
}

function typesFor(direction?: "back"): ViewTransitionOptions["types"] {
  return ({ fromLocation, toLocation, pathChanged }) => {
    // Read once, by the change the step back caused.
    const animated = performance.now() - browserAnimatedAt < sameStepMs
    browserAnimatedAt = -Infinity
    if (!fromLocation || !pathChanged) return false
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false
    const back =
      direction === "back" ||
      historyIndex(toLocation) < historyIndex(fromLocation)
    if (back && animated) return false
    return [back ? "back" : "forward"]
  }
}

function canTypeTransitions() {
  return (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    CSS.supports("selector(:active-view-transition-type(a))")
  )
}

/** The router's default: forward or back after the place in the history. */
export function pageTransition(): ViewTransitionOptions | false {
  return canTypeTransitions() ? { types: typesFor() } : false
}

/**
 * For links that lead back up (the back button in the header): they add
 * a step to the history, but should move like going back.
 */
export function backTransition(): ViewTransitionOptions | false {
  return canTypeTransitions() ? { types: typesFor("back") } : false
}
