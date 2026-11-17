import { useMemo } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import qrcode from "qrcode-generator"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

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

const qrCardVariants = cva("shrink-0 self-center rounded-[20px] bg-white", {
  variants: {
    size: {
      /** On the Invite page, 248 px. */
      default: "size-62 p-4",
      /** In a sheet (Spectator link), 212 px. */
      sm: "size-53 p-3.5",
    },
  },
  defaultVariants: { size: "default" },
})

/** The white card a `QrCode` sits on, in both themes. */
export function QrCard({
  className,
  size,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof qrCardVariants>) {
  return (
    <div
      data-slot="qr-card"
      className={cn(qrCardVariants({ size }), className)}
      {...props}
    />
  )
}
