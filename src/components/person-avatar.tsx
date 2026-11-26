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
import { useState } from "react"
import type { ComponentProps } from "react"

/**
 * A person's avatar: their picture, else the initial of their name.
 * Size and ring as on `Avatar` (`size`, `variant`). `zoomable` (where the
 * avatar isn't part of a link): a tap on a picture opens it large, to zoom
 * into (#62); a tap, a swipe or "Zurück" closes it again. An initial stays as
 * it is.
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
  const [open, setOpen] = useState(false)
  const avatar = (
    <Avatar {...props}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback>{initialOf(name)}</AvatarFallback>
    </Avatar>
  )
  if (!zoomable || !image) return avatar
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={false}
        render={avatar}
        aria-label={`Profilbild von ${name} vergrößern`}
      />
      <DialogContent
        variant="viewer"
        onClick={(event) => {
          // A tap on the black around the picture closes too.
          if (event.target === event.currentTarget) setOpen(false)
        }}
      >
        <DialogTitle className="sr-only">Profilbild von {name}</DialogTitle>
        <ZoomableImage
          src={largeAvatarUrl(image)}
          alt={`Profilbild von ${name}`}
          className="aspect-square w-full"
          onDismiss={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
