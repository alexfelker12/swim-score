import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initialOf } from "@/lib/initial"
import type { ComponentProps } from "react"

/**
 * A person's avatar: their picture, else the initial of their name.
 * Size and ring as on `Avatar` (`size`, `variant`).
 */
export function PersonAvatar({
  name,
  image,
  ...props
}: ComponentProps<typeof Avatar> & {
  name: string
  image?: string | null
}) {
  return (
    <Avatar {...props}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback>{initialOf(name)}</AvatarFallback>
    </Avatar>
  )
}
