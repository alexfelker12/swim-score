import type { AvatarCrop } from "@/server/profile"

/**
 * Geometry and encoding for the profile picture editor.
 *
 * The editor shows the image behind a circle that fills a square area. All
 * positions are in units of the circle's diameter (1 = the whole area), so
 * they don't depend on the screen size.
 */

export type ImageSize = { width: number; height: number }

/** Zoom 1 means the image's shorter side exactly fills the circle. */
export type View = { zoom: number; dx: number; dy: number }

const MIN_ZOOM = 1
const MAX_ZOOM = 3

/** The image's box inside the area, in diameters. */
export function imageBox(image: ImageSize, view: View) {
  const short = Math.min(image.width, image.height)
  const width = (image.width / short) * view.zoom
  const height = (image.height / short) * view.zoom
  return {
    left: 0.5 - width / 2 + view.dx,
    top: 0.5 - height / 2 + view.dy,
    width,
    height,
  }
}

/** Keeps the zoom in range and the circle completely covered by the image. */
export function clampView(image: ImageSize, view: View): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom))
  const { width, height } = imageBox(image, { zoom, dx: 0, dy: 0 })
  const maxDx = (width - 1) / 2
  const maxDy = (height - 1) / 2
  return {
    zoom,
    dx: Math.min(maxDx, Math.max(-maxDx, view.dx)),
    dy: Math.min(maxDy, Math.max(-maxDy, view.dy)),
  }
}

/**
 * Zooms while keeping the point under `focus` (relative to the area's
 * centre, in diameters) in place: under the fingers or the cursor.
 */
export function zoomAround(
  image: ImageSize,
  view: View,
  zoom: number,
  focus: { x: number; y: number }
): View {
  const next = clampView(image, { ...view, zoom })
  const ratio = next.zoom / view.zoom
  return clampView(image, {
    zoom: next.zoom,
    dx: focus.x - (focus.x - view.dx) * ratio,
    dy: focus.y - (focus.y - view.dy) * ratio,
  })
}

export function viewToCrop(image: ImageSize, view: View): AvatarCrop {
  const box = imageBox(image, view)
  return {
    x: clamp01(-box.left / box.width),
    y: clamp01(-box.top / box.height),
    size: Math.min(1, 1 / view.zoom),
  }
}

export function cropToView(image: ImageSize, crop: AvatarCrop): View {
  const zoom = 1 / crop.size
  const { width, height } = imageBox(image, { zoom, dx: 0, dy: 0 })
  const left = -crop.x * width
  const top = -crop.y * height
  return clampView(image, {
    zoom,
    dx: left - 0.5 + width / 2,
    dy: top - 0.5 + height / 2,
  })
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

/** Loads an image; remote images are requested with CORS so they can be re-encoded. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (/^https?:/.test(src)) image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Could not load the picture"))
    image.src = src
  })
}

const AVATAR_SIDE = 256
const SOURCE_MAX_SIDE = 1600
const SOURCE_MAX_BYTES = 1024 * 1024

/** The 256 × 256 px avatar for the given crop. */
export function renderAvatar(
  image: HTMLImageElement,
  crop: AvatarCrop
): Promise<Blob> {
  const short = Math.min(image.naturalWidth, image.naturalHeight)
  const side = crop.size * short
  const canvas = createCanvas(AVATAR_SIDE, AVATAR_SIDE)
  context(canvas).drawImage(
    image,
    crop.x * image.naturalWidth,
    crop.y * image.naturalHeight,
    side,
    side,
    0,
    0,
    AVATAR_SIDE,
    AVATAR_SIDE
  )
  return encode(canvas, 0.85)
}

/** The source image, scaled down to at most 1600 px on its longer side. */
export async function renderSource(image: HTMLImageElement): Promise<Blob> {
  const scale = Math.min(
    1,
    SOURCE_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight)
  )
  const canvas = createCanvas(
    Math.round(image.naturalWidth * scale),
    Math.round(image.naturalHeight * scale)
  )
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height)
  for (const quality of [0.85, 0.7, 0.5]) {
    const blob = await encode(canvas, quality)
    if (blob.size <= SOURCE_MAX_BYTES) return blob
  }
  throw new Error("The picture is too large")
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const result = canvas.getContext("2d")
  if (!result) throw new Error("Canvas is not available")
  return result
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  return canvas
}

/** WebP where the browser can encode it, otherwise JPEG. */
async function encode(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  const webp = await toBlob(canvas, "image/webp", quality)
  if (webp?.type === "image/webp") return webp
  const jpeg = await toBlob(canvas, "image/jpeg", quality)
  if (!jpeg) throw new Error("Could not encode the picture")
  return jpeg
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}
