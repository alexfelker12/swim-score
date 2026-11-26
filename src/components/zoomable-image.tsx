import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { ComponentProps, PointerEvent } from "react"

/** Where the image is: its zoom and how far it moved, in px from the centre. */
type View = { scale: number; x: number; y: number }

const MAX_SCALE = 4
/** Zoom of a double tap. */
const TAP_SCALE = 2.5
const DOUBLE_TAP_MS = 300

/**
 * An image to zoom into with two fingers or a double tap, and to move while
 * zoomed in (the zoomed profile picture, #62). Never smaller than it fits,
 * never moved out of its box.
 */
export function ZoomableImage({
  className,
  style,
  ...props
}: ComponentProps<"img">) {
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  const box = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{
    view: View
    distance: number
    focus: { x: number; y: number }
  } | null>(null)
  const lastTap = useRef({ at: 0, moved: false })

  /** A point relative to the box's centre. */
  function fromCentre(x: number, y: number) {
    const rect = box.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: x - rect.left - rect.width / 2,
      y: y - rect.top - rect.height / 2,
    }
  }

  /** Keeps the zoom in range and the image covering its box. */
  function clamp(next: View): View {
    const scale = Math.min(MAX_SCALE, Math.max(1, next.scale))
    const rect = box.current?.getBoundingClientRect()
    const maxX = rect ? ((scale - 1) * rect.width) / 2 : 0
    const maxY = rect ? ((scale - 1) * rect.height) / 2 : 0
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }

  /** Zooms to `scale` keeping the point `focus` (from the centre) in place. */
  function zoomAround(
    from: View,
    scale: number,
    focus: { x: number; y: number }
  ) {
    const ratio = Math.min(MAX_SCALE, Math.max(1, scale)) / from.scale
    return clamp({
      scale: from.scale * ratio,
      x: focus.x - (focus.x - from.x) * ratio,
      y: focus.y - (focus.y - from.y) * ratio,
    })
  }

  function startPinch() {
    const [a, b] = [...pointers.current.values()]
    gesture.current = {
      view,
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      focus: fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2),
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    lastTap.current.moved = false
    if (pointers.current.size === 2) startPinch()
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const point = { x: event.clientX, y: event.clientY }
    pointers.current.set(event.pointerId, point)
    if (Math.hypot(point.x - previous.x, point.y - previous.y) > 2) {
      lastTap.current.moved = true
    }
    if (pointers.current.size >= 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()]
      const start = gesture.current
      const scale =
        (start.view.scale * Math.hypot(a.x - b.x, a.y - b.y)) / start.distance
      setView(zoomAround(start.view, scale, start.focus))
    } else if (pointers.current.size === 1 && view.scale > 1) {
      setView((v) =>
        clamp({
          ...v,
          x: v.x + point.x - previous.x,
          y: v.y + point.y - previous.y,
        })
      )
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) gesture.current = null
    if (pointers.current.size > 0 || lastTap.current.moved) return
    const now = performance.now()
    if (now - lastTap.current.at < DOUBLE_TAP_MS) {
      lastTap.current.at = 0
      setView((v) =>
        v.scale > 1
          ? { scale: 1, x: 0, y: 0 }
          : zoomAround(v, TAP_SCALE, fromCentre(event.clientX, event.clientY))
      )
    } else {
      lastTap.current.at = now
    }
  }

  return (
    <div
      ref={box}
      data-slot="zoomable-image"
      data-zoomed={view.scale > 1 || undefined}
      className="w-full touch-none overflow-hidden select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img
        draggable={false}
        className={cn("size-full object-contain", className)}
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          ...style,
        }}
        {...props}
      />
    </div>
  )
}
