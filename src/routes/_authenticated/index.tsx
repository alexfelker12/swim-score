import { Link, createFileRoute } from "@tanstack/react-router"
import { QrCode } from "lucide-react"
import { Logo } from "@/components/logo"
import { UserAvatar } from "@/components/user-avatar"

export const Route = createFileRoute("/_authenticated/")({ component: Start })

/** Start page; for now only its empty state (the full page comes with #15). */
function Start() {
  const { viewer } = Route.useRouteContext()
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-16 items-center justify-between px-5">
        <Logo />
        <Link to="/profile" aria-label="Profil öffnen" className="rounded-full">
          <UserAvatar name={viewer.name} image={viewer.image} size={44} />
        </Link>
      </header>
      <main className="flex flex-1 flex-col justify-center gap-4 px-6 pb-16">
        <h1 className="text-[30px] font-bold">Hallo {viewer.name}</h1>
        <p className="text-lg text-pretty text-muted-foreground">
          Du bist noch in keiner Gruppe. Leg eine an und lade deine Runde ein,
          oder lass dir von jemandem den Einladungslink geben.
        </p>
        <div className="flex gap-3 rounded-[14px] bg-muted p-4 text-[15px] text-muted-foreground">
          <QrCode className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
          <span className="text-pretty">
            Am Tisch geht es am schnellsten: Der Verwalter zeigt den QR-Code, du
            scannst ihn mit der Kamera.
          </span>
        </div>
      </main>
    </div>
  )
}
