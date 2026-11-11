import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { ChevronRight, Plus, QrCode } from "lucide-react"
import { Logo } from "@/components/logo"
import { UserAvatar } from "@/components/user-avatar"
import { myGroupsQuery } from "@/lib/queries"

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ context }) => context.queryClient.query(myGroupsQuery()),
  component: Start,
})

/** Start page: so far only "Meine Gruppen" and the empty state (the rest comes with #15). */
function Start() {
  const { viewer } = Route.useRouteContext()
  const { data: groups } = useSuspenseQuery(myGroupsQuery())
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between px-5">
        <Logo />
        <Link to="/profile" aria-label="Profil öffnen" className="rounded-full">
          <UserAvatar name={viewer.name} image={viewer.image} size={44} />
        </Link>
      </header>
      {groups.length === 0 ? (
        <Empty name={viewer.name} />
      ) : (
        <main className="flex flex-col px-4 pt-2 pb-6">
          <section aria-labelledby="my-groups" className="flex flex-col gap-2">
            <h2 id="my-groups" className="mx-1 mb-1 text-[17px] font-semibold">
              Meine Gruppen
            </h2>
            {groups.map((group) => (
              <Link
                key={group.id}
                to="/groups/$groupId"
                params={{ groupId: group.id }}
                className="flex min-h-17 items-center justify-between gap-3 rounded-[14px] border-[1.5px] border-border bg-card px-4"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[17px] font-semibold">
                    {group.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {group.playerCount} Spieler
                  </span>
                </span>
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            ))}
            <Link
              to="/groups/new"
              className="flex h-14 items-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-border px-4 font-semibold text-primary"
            >
              <Plus className="size-5" aria-hidden="true" />
              Gruppe anlegen
            </Link>
          </section>
        </main>
      )}
    </div>
  )
}

function Empty({ name }: { name: string }) {
  return (
    <>
      <main className="flex flex-1 flex-col justify-center gap-4 px-6 pb-10">
        <h1 className="text-[30px] font-bold">Hallo {name}</h1>
        <p className="text-lg text-pretty text-muted-foreground">
          Du bist noch in keiner Gruppe. Leg eine an und lade deine Runde ein,
          oder lass dir von jemandem den Einladungslink geben.
        </p>
        <div className="mt-2 flex gap-3.5 rounded-[14px] bg-muted p-4 text-[15px] text-muted-foreground">
          <QrCode className="mt-0.5 size-5.5 shrink-0" aria-hidden="true" />
          <span className="text-pretty">
            Am Tisch geht es am schnellsten: Der Verwalter zeigt den QR-Code, du
            scannst ihn mit der Kamera.
          </span>
        </div>
      </main>
      <div className="px-4 pb-6">
        <Link
          to="/groups/new"
          className="flex h-14 items-center justify-center rounded-[14px] bg-primary text-base font-semibold text-primary-foreground"
        >
          Gruppe anlegen
        </Link>
      </div>
    </>
  )
}
