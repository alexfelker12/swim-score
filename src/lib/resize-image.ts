const SIZE = 256

/**
 * Crops a picture to a centred square and scales it to 256 × 256 px, as WebP
 * where the browser can encode it, otherwise JPEG. Keeps uploads small enough
 * to store in Postgres.
 */
export async function resizeForAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement("canvas")
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas is not available")
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE
  )
  bitmap.close()
  const webp = await toBlob(canvas, "image/webp")
  if (webp?.type === "image/webp") return webp
  const jpeg = await toBlob(canvas, "image/jpeg")
  if (!jpeg) throw new Error("Could not encode the picture")
  return jpeg
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85))
}
