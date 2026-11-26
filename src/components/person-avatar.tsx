import { ZoomableImage } from "@/components/zoomable-image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { largeAvatarUrl } from "@/lib/avatar-url"
import { initialOf } from "@/lib/initial"
import type { ComponentProps } from "react"

/**
 * A person's avatar: their picture, else the initial of their name.
 * Size and ring as on `Avatar` (`size`, `variant`). `zoomable` (where the
 * avatar isn't part of a link): a tap on a picture opens it large, to zoom
 * into (#62); an initial stays as it is.
 */
export function PersonAvatar({
  name,
  image,
  zoomable = false,
  ...props
}: ComponentProps<typeof Avatar> & {
  name: string
  image?: string | null
  zoomable?: boolean
}) {
  const avatar = (
    <Avatar {...props}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback>{initialOf(name)}</AvatarFallback>
    </Avatar>
  )
  if (!zoomable || !image) return avatar
  return (
    <Dialog>
      <DialogTrigger
        nativeButton={false}
        render={avatar}
        aria-label={`Profilbild von ${name} vergrößern`}
      />
      <DialogContent variant="viewer">
        <DialogTitle className="sr-only">Profilbild von {name}</DialogTitle>
        <ZoomableImage
          src={largeAvatarUrl(image)}
          alt={`Profilbild von ${name}`}
          className="aspect-square w-full"
        />
      </DialogContent>
    </Dialog>
  )
}
