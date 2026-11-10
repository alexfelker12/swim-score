import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ImageUp, Move, Trash2 } from "lucide-react"
import {
  clampView,
  cropToView,
  imageBox,
  loadImage,
  renderAvatar,
  renderSource,
  viewToCrop,
  zoomAround,
} from "@/lib/avatar-crop"
import { cn } from "@/lib/utils"
import { useModal } from "@/lib/use-modal"
import {
  getAvatarSourceFn,
  removeAvatarFn,
  setAvatarFn,
} from "@/server/functions"
import type { ImageSize, View } from "@/lib/avatar-crop"

/** What the editor opens with: a freshly chosen file, or the saved picture. */
export type AvatarEditorStart = { kind: "file"; file: File } | { kind: "saved" }

type Picture = {
  image: HTMLImageElement
  src: string
  /** Chosen in this editor session, so the source must be uploaded anew. */
  isNew: boolean
}

const UNREADABLE = "Dieses Bild ließ sich nicht verwenden."
const SAVE_FAILED = "Das hat nicht geklappt. Versuch es noch einmal."
const START_VIEW: View = { zoom: 1, dx: 0, dy: 0 }

/** The square area keeps clear of header, previews and actions on short screens. */
const AREA_WIDTH = "min(100%, calc(100svh - 380px))"

/**
 * Full-screen editor for the profile picture: move and zoom the image behind
 * a circle, pick another one, or remove it. Nothing reaches the server
 * before "Übernehmen" / "Speichern".
 */
export function AvatarEditor({
  start,
  hasSavedPicture,
  name,
  onClose,
  onSaved,
}: {
  start: AvatarEditorStart
  hasSavedPicture: boolean
  name: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [picture, setPicture] = useState<Picture | null>(null)
  const [view, setView] = useState<View>(START_VIEW)
  const [removed, setRemoved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const objectUrl = useRef<string | null>(null)
  // Every image load gets a number; a load that finishes after a newer one
  // started, or after the editor closed, is dropped.
  const loads = useRef(0)
  const latest = useRef({ onClose, saving })
  latest.current = { onClose, saving }

  function show(next: Picture, nextView: View) {
    if (objectUrl.current && objectUrl.current !== next.src) {
      URL.revokeObjectURL(objectUrl.current)
    }
    objectUrl.current = next.isNew ? next.src : null
    setPicture(next)
    setView(nextView)
    setRemoved(false)
    setError(null)
  }

  async function showFile(file: File) {
    const load = ++loads.current
    const url = URL.createObjectURL(file)
    try {
      const image = await loadImage(url)
      if (load !== loads.current) {
        URL.revokeObjectURL(url)
        return
      }
      show({ image, src: url, isNew: true }, START_VIEW)
    } catch {
      URL.revokeObjectURL(url)
      if (load === loads.current) setError(UNREADABLE)
    }
  }

  async function showSaved() {
    const load = ++loads.current
    try {
      const saved = await getAvatarSourceFn()
      if (!saved || load !== loads.current) return
      const image = await loadImage(saved.src)
      if (load !== loads.current) return
      show(
        { image, src: saved.src, isNew: false },
        cropToView(naturalSize(image), saved.crop)
      )
    } catch {
      if (load === loads.current) setError(UNREADABLE)
    }
  }

  // Opens with the chosen file or the saved picture, once per mount.
  useEffect(() => {
    if (start.kind === "file") void showFile(start.file)
    else void showSaved()
    return () => {
      loads.current++
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = null
    }
  }, [])

  useModal(dialog, () => {
    if (!latest.current.saving) latest.current.onClose()
  })

  async function save() {
    setSaving(true)
    setError(null)
    try {
      if (removed) {
        const result = await removeAvatarFn()
        if (!result.ok) throw new Error(SAVE_FAILED)
      } else if (picture) {
        await uploadPicture(
          picture,
          viewToCrop(naturalSize(picture.image), view)
        )
      }
      await onSaved()
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message === UNREADABLE
          ? UNREADABLE
          : SAVE_FAILED
      )
      setSaving(false)
    }
  }

  const errorLine = error ? (
    <p role="alert" className="text-[13px] text-destructive">
      {error}
    </p>
  ) : null

  // Rendered into <body>, above and outside the page it was opened from.
  return createPortal(
    <div
      ref={dialog}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-editor-title"
      className="fixed inset-0 z-50 mx-auto flex max-w-[500px] flex-col bg-background outline-none"
    >
      <header className="flex h-14 shrink-0 items-center justify-center px-4">
        <h1 id="avatar-editor-title" className="text-[17px] font-semibold">
          Profilbild
        </h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 px-6 pt-1 pb-4">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3.5">
          {removed ? (
            <>
              <div
                className="flex aspect-square flex-col items-center justify-center gap-4 rounded-[20px] border-[1.5px] border-dashed border-border bg-card"
                style={{ width: AREA_WIDTH }}
              >
                <span
                  aria-hidden="true"
                  className="flex size-40 items-center justify-center rounded-full bg-muted text-[64px] font-semibold text-primary"
                >
                  {name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <span className="max-w-[260px] text-center text-[15px] text-pretty text-muted-foreground">
                  Ohne Bild sehen alle in deinen Gruppen deine Initiale.
                </span>
              </div>
              {errorLine}
              <button
                type="button"
                onClick={() => {
                  setRemoved(false)
                  setError(null)
                }}
                className="h-11 rounded-xl px-4 text-[15px] font-semibold text-primary"
              >
                Bild doch behalten
              </button>
            </>
          ) : (
            <>
              <CropArea picture={picture} view={view} onChange={setView} />
              {errorLine ?? (
                <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <Move className="size-4" aria-hidden="true" />
                  Ziehen zum Verschieben, mit zwei Fingern zoomen
                </p>
              )}
              {picture ? (
                <div className="flex items-center gap-3 self-stretch px-1 py-0.5">
                  <ImageInCircle picture={picture} view={view} size={56} />
                  <ImageInCircle picture={picture} view={view} size={36} />
                  <span className="text-[13px] text-pretty text-muted-foreground">
                    So sehen dich die anderen in Listen und Spielen.
                  </span>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-border bg-card text-[15px] font-medium"
          >
            <ImageUp className="size-[18px]" aria-hidden="true" />
            {removed ? "Bild auswählen" : "Anderes Bild"}
          </button>
          {hasSavedPicture && !removed ? (
            <button
              type="button"
              onClick={() => {
                setRemoved(true)
                setError(null)
              }}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-border bg-card text-[15px] font-semibold text-destructive"
            >
              <Trash2 className="size-[18px]" aria-hidden="true" />
              Entfernen
            </button>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void showFile(file)
            }}
          />
        </div>
      </div>

      <footer className="flex shrink-0 gap-2.5 border-t border-border px-4 pt-3 pb-6">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="h-13 flex-1 rounded-[14px] border-[1.5px] border-border text-base font-medium disabled:opacity-40"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || (!removed && picture === null)}
          className="h-13 flex-1 rounded-[14px] bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40"
        >
          {removed ? "Speichern" : "Übernehmen"}
        </button>
      </footer>
    </div>,
    document.body
  )
}

/**
 * Renders avatar and source in the browser and uploads both with the crop.
 * Fails with UNREADABLE when the picture can't be encoded (or the server
 * says it isn't an image), otherwise with SAVE_FAILED.
 */
async function uploadPicture(
  picture: Picture,
  crop: ReturnType<typeof viewToCrop>
) {
  let files: [Blob, Blob]
  try {
    files = await Promise.all([
      renderAvatar(picture.image, crop),
      sourceBlob(picture),
    ])
  } catch {
    throw new Error(UNREADABLE)
  }
  const form = new FormData()
  form.set("avatar", files[0], "avatar")
  form.set("source", files[1], "source")
  form.set("crop", JSON.stringify(crop))
  const result = await setAvatarFn({ data: form })
  if (!result.ok) {
    throw new Error(result.code === "invalidImage" ? UNREADABLE : SAVE_FAILED)
  }
}

function naturalSize(image: HTMLImageElement): ImageSize {
  return { width: image.naturalWidth, height: image.naturalHeight }
}

/** The source to upload: the saved one as it is, otherwise a downscaled copy. */
async function sourceBlob(picture: Picture): Promise<Blob> {
  if (!picture.isNew && picture.src.startsWith("data:")) {
    return (await fetch(picture.src)).blob()
  }
  return renderSource(picture.image)
}

/** Where the active pointers are: their midpoint and, for two, their distance. */
function pointerSpread(points: Array<{ x: number; y: number }>) {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length
  const distance =
    points.length > 1
      ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      : 0
  return { cx, cy, distance }
}

type Gesture = ReturnType<typeof pointerSpread> & { view: View }

/**
 * The image behind the circle. One pointer moves it; two pointers zoom by
 * their distance around their midpoint and move with it. Wheel and trackpad
 * pinch (a wheel event with ctrlKey) zoom around the cursor; +, − and the
 * arrow keys work when the area has focus.
 */
function CropArea({
  picture,
  view,
  onChange,
}: {
  picture: Picture | null
  view: View
  onChange: (view: View) => void
}) {
  const area = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture | null>(null)
  const latest = useRef({ view, picture, onChange })
  latest.current = { view, picture, onChange }
  const [dragging, setDragging] = useState(false)

  /** Clamps and reports a new view, computed from the current one. */
  function update(next: (image: ImageSize, now: View) => View) {
    const { picture: shown, view: now, onChange: change } = latest.current
    if (!shown) return
    const image = naturalSize(shown.image)
    change(clampView(image, next(image, now)))
  }

  /** The area's width in px, and a point's offset from its centre in diameters. */
  function measure(x = 0, y = 0) {
    const rect = area.current?.getBoundingClientRect()
    const diameter = rect?.width || 1
    return {
      diameter,
      focus: rect
        ? {
            x: (x - rect.left) / diameter - 0.5,
            y: (y - rect.top) / diameter - 0.5,
          }
        : { x: 0, y: 0 },
    }
  }

  // React registers wheel listeners as passive; keeping the page from
  // scrolling or zooming needs a native one. update and measure only read refs.
  useEffect(() => {
    const element = area.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const { diameter, focus } = measure(event.clientX, event.clientY)
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? diameter
            : 1
      const factor = Math.exp(
        -event.deltaY * unit * (event.ctrlKey ? 0.01 : 0.002)
      )
      update((image, now) => zoomAround(image, now, now.zoom * factor, focus))
    }
    element.addEventListener("wheel", onWheel, { passive: false })
    return () => element.removeEventListener("wheel", onWheel)
  }, [])

  function restartGesture() {
    const points = [...pointers.current.values()]
    gesture.current = points.length
      ? { ...pointerSpread(points), view: latest.current.view }
      : null
    setDragging(gesture.current !== null)
  }

  function endPointer(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId)
    restartGesture()
  }

  const box = picture ? imageBox(naturalSize(picture.image), view) : null

  return (
    <div
      ref={area}
      tabIndex={0}
      role="group"
      aria-label="Bildausschnitt. Ziehen oder Pfeiltasten zum Verschieben, mit zwei Fingern oder Plus und Minus zoomen."
      className={cn(
        "relative aspect-square shrink-0 touch-none overflow-hidden rounded-[20px] bg-avatar-backdrop select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        picture && (dragging ? "cursor-grabbing" : "cursor-grab")
      )}
      style={{ width: AREA_WIDTH }}
      onPointerDown={(event) => {
        if (!picture) return
        if (event.pointerType === "mouse" && event.button !== 0) return
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Not every pointer can be captured (e.g. synthetic ones).
        }
        pointers.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        })
        restartGesture()
      }}
      onPointerMove={(event) => {
        const begin = gesture.current
        if (!begin || !pointers.current.has(event.pointerId)) return
        pointers.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        })
        const now = pointerSpread([...pointers.current.values()])
        const { diameter, focus } = measure(begin.cx, begin.cy)
        update((image) => {
          const zoom =
            begin.distance && now.distance
              ? (begin.view.zoom * now.distance) / begin.distance
              : begin.view.zoom
          const zoomed = zoomAround(image, begin.view, zoom, focus)
          return {
            zoom: zoomed.zoom,
            dx: zoomed.dx + (now.cx - begin.cx) / diameter,
            dy: zoomed.dy + (now.cy - begin.cy) / diameter,
          }
        })
      }}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onKeyDown={(event) => {
        const step = (event.shiftKey ? 40 : 10) / measure().diameter
        const moves: Partial<Record<string, [number, number]>> = {
          ArrowLeft: [step, 0],
          ArrowRight: [-step, 0],
          ArrowUp: [0, step],
          ArrowDown: [0, -step],
        }
        const zooms: Partial<Record<string, number>> = {
          "+": 0.1,
          "=": 0.1,
          "-": -0.1,
        }
        const move = moves[event.key]
        const zoomBy = zooms[event.key]
        if (move) {
          update((_, now) => ({
            ...now,
            dx: now.dx + move[0],
            dy: now.dy + move[1],
          }))
        } else if (zoomBy) {
          update((image, now) =>
            zoomAround(image, now, now.zoom + zoomBy, { x: 0, y: 0 })
          )
        } else {
          return
        }
        event.preventDefault()
      }}
    >
      {picture && box ? <PositionedImage src={picture.src} box={box} /> : null}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_400px_var(--avatar-shade),inset_0_0_0_2px_var(--avatar-ring)]"
      />
    </div>
  )
}

/** The image placed by its box, in percent of the surrounding circle. */
function PositionedImage({
  src,
  box,
}: {
  src: string
  box: ReturnType<typeof imageBox>
}) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="pointer-events-none absolute max-w-none"
      style={{
        left: `${box.left * 100}%`,
        top: `${box.top * 100}%`,
        width: `${box.width * 100}%`,
        height: `${box.height * 100}%`,
      }}
    />
  )
}

/** A small round preview of the current crop. */
function ImageInCircle({
  picture,
  view,
  size,
}: {
  picture: Picture
  view: View
  size: number
}) {
  return (
    <span
      aria-hidden="true"
      className="relative shrink-0 overflow-hidden rounded-full bg-avatar-backdrop"
      style={{ width: size, height: size }}
    >
      <PositionedImage
        src={picture.src}
        box={imageBox(naturalSize(picture.image), view)}
      />
    </span>
  )
}
