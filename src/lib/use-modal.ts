import { useEffect, useRef } from "react"
import type { RefObject } from "react"

/**
 * Makes the element a modal while it is mounted: the page behind can't be
 * scrolled, focused or clicked, Escape calls `onEscape`, and focus returns
 * to where it was when the modal closes. The element must be rendered into
 * <body> (a portal).
 */
export function useModal(
  modal: RefObject<HTMLElement | null>,
  onEscape: () => void
) {
  const latest = useRef(onEscape)
  latest.current = onEscape
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const behind = [...document.body.children].filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        element !== modal.current &&
        !element.inert
    )
    behind.forEach((element) => (element.inert = true))
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    modal.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") latest.current()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
      behind.forEach((element) => (element.inert = false))
      opener?.focus()
    }
  }, [modal])
}
