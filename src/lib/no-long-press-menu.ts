import { useEffect } from "react"

/**
 * What is tapped like an app, not read like a page (#56, ADR 0015): links,
 * buttons, tabs and the rows of a Game. Rows that are only text keep their
 * menu. The same list is in src/styles.css (text selection).
 */
const tapTargets =
  'a, button, [role="button"], [role="tab"], [data-slot="player-row"]'

/**
 * A long press on a link or button opens no menu (Android shows "Open in
 * new tab" and the like for links; text selection is off in CSS). Only for
 * touch: a right click with the mouse keeps its menu, and so do fields and
 * text.
 */
export function useNoLongPressMenu() {
  useEffect(() => {
    let lastPointer = ""
    const onPointerDown = (event: PointerEvent) => {
      lastPointer = event.pointerType
    }
    const onContextMenu = (event: Event) => {
      const touch =
        (event instanceof PointerEvent && event.pointerType === "touch") ||
        lastPointer === "touch"
      if (
        touch &&
        event.target instanceof Element &&
        event.target.closest(tapTargets)
      ) {
        event.preventDefault()
      }
    }
    window.addEventListener("pointerdown", onPointerDown, { capture: true })
    window.addEventListener("contextmenu", onContextMenu)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      })
      window.removeEventListener("contextmenu", onContextMenu)
    }
  }, [])
}
