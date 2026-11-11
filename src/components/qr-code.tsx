import { useMemo } from "react"
import qrcode from "qrcode-generator"

/** A QR code as one SVG path; dark on the white card in both themes so cameras read it. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { size, path } = useMemo(() => {
    const code = qrcode(0, "M")
    code.addData(text)
    code.make()
    const count = code.getModuleCount()
    let d = ""
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (code.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`
      }
    }
    return { size: count, path: d }
  }, [text])
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="size-full fill-black"
    >
      <path d={path} />
    </svg>
  )
}
