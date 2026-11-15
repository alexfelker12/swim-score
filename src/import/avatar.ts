import sharp from "sharp"
import {
  AVATAR_SIDE,
  SOURCE_MAX_BYTES,
  SOURCE_MAX_SIDE,
} from "@/lib/avatar-crop"
import type { AvatarCrop } from "../server/db/schema"

// The same as the browser does on upload (src/lib/avatar-crop.ts), with
// sharp instead of a canvas: the old pictures become pictures of the new
// app, which their owners can crop again in the editor.

export type PreparedAvatar = {
  contentType: "image/webp"
  data: Uint8Array
  sourceContentType: "image/webp"
  source: Uint8Array
  crop: AvatarCrop
}

/**
 * A profile picture as the new app stores it: the 256 px avatar of the
 * middle square, the source scaled down to at most 1600 px (and 1 MB), and
 * that crop.
 */
export async function prepareAvatar(
  input: Uint8Array
): Promise<PreparedAvatar> {
  // Turned upright as the camera meant it, like a browser shows it.
  const upright = await sharp(input)
    .rotate()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = upright.info
  const side = Math.min(width, height)
  const left = Math.round((width - side) / 2)
  const top = Math.round((height - side) / 2)
  const crop = { x: left / width, y: top / height, size: 1 }

  const data = await sharp(upright.data)
    .extract({ left, top, width: side, height: side })
    .resize(AVATAR_SIDE, AVATAR_SIDE)
    .webp({ quality: 85 })
    .toBuffer()

  let source: Buffer | null = null
  for (const quality of [85, 70, 50]) {
    const candidate = await sharp(upright.data)
      .resize(SOURCE_MAX_SIDE, SOURCE_MAX_SIDE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer()
    if (candidate.byteLength <= SOURCE_MAX_BYTES) {
      source = candidate
      break
    }
  }
  if (!source) throw new Error("The picture is too large")

  return {
    contentType: "image/webp",
    data: new Uint8Array(data),
    sourceContentType: "image/webp",
    source: new Uint8Array(source),
    crop,
  }
}
