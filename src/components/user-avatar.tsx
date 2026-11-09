import { cn } from "@/lib/utils"

/** Profile picture, or the initial of the display name on a muted circle. */
export function UserAvatar({
  name,
  image,
  size,
  className,
}: {
  name: string
  image: string | null
  size: number
  className?: string
}) {
  const style = { width: size, height: size, fontSize: size * 0.4 }
  if (image) {
    return (
      <img
        src={image}
        alt=""
        style={style}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-primary",
        className
      )}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  )
}
