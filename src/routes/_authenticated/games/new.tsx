import { useEffect, useRef, useState } from "react"
import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { ChevronLeft, CircleAlert, GripVertical, Plus, X } from "lucide-react"
import { PrimaryButton } from "@/components/buttons"
import { DealerBadge } from "@/components/dealer-badge"
import { TextInput } from "@/components/form-field"
import { cn } from "@/lib/utils"
import { standardRuleSet } from "@/rules-engine"
import { addGuestFn, getNewGameFn, startGameFn } from "@/server/functions"
import type { NewGame } from "@/server/games"

export const Route = createFileRoute("/_authenticated/games/new")({
  validateSearch: (search: Record<string, unknown>): { groupId: string } => ({
    groupId: typeof search.groupId === "string" ? search.groupId : "",
  }),
  loaderDeps: ({ search }) => ({ groupId: search.groupId }),
  // The form starts from the loaded preselection, so it must never start
  // from a cached one while the fresh one is still loading.
  gcTime: 0,
  loader: async ({ deps }) => {
    const setup = await getNewGameFn({ data: { groupId: deps.groupId } })
    if (!setup) throw notFound()
    return setup
  },
  component: NewGamePage,
})

const { minParticipants, maxParticipants } = standardRuleSet
/** Row height plus gap; dragging moves a row one seat per this many pixels. */
const ROW_PITCH = 64

function NewGamePage() {
  const setup = Route.useLoaderData()
  const { groupId } = Route.useSearch()
  const navigate = useNavigate()
  const [seated, setSeated] = useState(setup.preselected)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const byId = new Map(setup.players.map((p) => [p.id, p]))
  const seatedPlayers = seated.flatMap((id) => byId.get(id) ?? [])
  const others = setup.players.filter((p) => !seated.includes(p.id))
  const problem =
    seated.length < minParticipants
      ? `Mindestens ${minParticipants} Spieler nötig.`
      : seated.length > maxParticipants
        ? `Höchstens ${maxParticipants} Spieler. Nimm ${tooMany(seated.length - maxParticipants)} raus.`
        : null

  async function start() {
    setPending(true)
    setError(null)
    const result = await startGameFn({ data: { groupId, playerIds: seated } })
    if (!result.ok) {
      setPending(false)
      setError("Das Spiel ließ sich nicht starten. Lade die Seite neu.")
      return
    }
    await navigate({
      to: "/games/$gameId",
      params: { gameId: result.value.id },
    })
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[52px_minmax(0,1fr)_52px] items-center px-1">
        <Link
          to="/groups/$groupId"
          params={{ groupId }}
          aria-label="Zurück zur Gruppe"
          className="flex size-11 items-center justify-center justify-self-center rounded-xl"
        >
          <ChevronLeft className="size-6" aria-hidden="true" />
        </Link>
        <div className="flex min-w-0 flex-col items-center">
          <h1 className="text-xl leading-tight font-semibold">Neues Spiel</h1>
          <span className="max-w-full truncate text-[13px] text-muted-foreground">
            {setup.groupName}
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 pt-2 pb-4">
        <div className="mx-1 flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold">
            Am Tisch, im Uhrzeigersinn
          </h2>
          <span
            className={cn(
              "text-[15px] font-semibold tabular-nums",
              problem ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {seated.length}/{maxParticipants}
          </span>
        </div>
        <SeatingList
          players={seatedPlayers}
          onReorder={setSeated}
          onRemove={(id) => setSeated((now) => now.filter((s) => s !== id))}
        />

        <h2 className="mx-1 mt-4 text-[17px] font-semibold">Nicht dabei</h2>
        <NewGuest
          groupId={groupId}
          onAdded={(id) => setSeated((now) => [...now, id])}
        />
        <ul className="flex flex-col gap-2">
          {others.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => setSeated((now) => [...now, player.id])}
                aria-label={`${player.name} an den Tisch setzen`}
                className="flex h-13 w-full items-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-border px-4 text-left"
              >
                <span className="truncate text-[17px] font-semibold">
                  {player.name}
                </span>
                {player.guest ? <GuestLabel /> : null}
                <Plus
                  className="ml-auto size-5.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      </main>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-background px-4 pt-3 pb-6">
        {problem || error ? (
          <p
            role="alert"
            className="flex items-center gap-2 text-[15px] font-medium text-destructive"
          >
            <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
            {error ?? problem}
          </p>
        ) : null}
        <PrimaryButton
          type="button"
          onClick={start}
          disabled={problem !== null || pending}
        >
          Spiel starten
        </PrimaryButton>
      </div>
    </div>
  )
}

function tooMany(count: number) {
  return count === 1 ? "1 Person" : `${count} Personen`
}

function GuestLabel() {
  return <span className="text-sm text-muted-foreground">Gast</span>
}

type Seated = NewGame["players"][number]

type Drag = {
  id: string
  from: number
  /** Pointer position on the page (not the screen) where the drag began. */
  startY: number
  /** Pointer position on the page now; differs from the screen while scrolling. */
  pageY: number
}

/** Where a row dragged from `from` by `offset` pixels lands. */
function dropIndex(from: number, offset: number, count: number) {
  return Math.max(0, Math.min(count - 1, from + Math.round(offset / ROW_PITCH)))
}

/** Pixels from the screen's top and bottom edge in which dragging scrolls. */
const SCROLL_ZONE = { top: 96, bottom: 150 }
const MAX_SCROLL_SPEED = 14

/**
 * The Seating Order. A row moves by dragging its grip (finger or mouse) or
 * with the arrow keys while the grip has focus. While dragging, the order
 * stays as it is: the dragged row follows the pointer, the rows it passes
 * make room, and the new order is set on release. Near the top or bottom of
 * the screen the page scrolls along.
 */
function SeatingList({
  players,
  onReorder,
  onRemove,
}: {
  players: Array<Seated>
  onReorder: (ids: Array<string>) => void
  onRemove: (id: string) => void
}) {
  const [drag, setDrag] = useState<Drag | null>(null)
  /** Ends a drag without dropping, e.g. when the page is left mid-drag. */
  const abandon = useRef<(() => void) | null>(null)
  useEffect(() => () => abandon.current?.(), [])
  const ids = players.map((p) => p.id)

  function moveBy(id: string, by: number) {
    const from = ids.indexOf(id)
    const to = Math.max(0, Math.min(ids.length - 1, from + by))
    if (to !== from) onReorder(moved(ids, from, to))
  }

  function startDrag(id: string, event: React.PointerEvent) {
    if (event.button !== 0) return
    event.preventDefault()
    const from = ids.indexOf(id)
    const startY = event.clientY + window.scrollY
    let clientY = event.clientY
    let current: Drag = { id, from, startY, pageY: startY }
    setDrag(current)

    const update = () => {
      current = { ...current, pageY: clientY + window.scrollY }
      setDrag(current)
    }
    // Scroll while the pointer is near an edge, every frame until released.
    let frame = requestAnimationFrame(function scroll() {
      const fromTop = clientY - SCROLL_ZONE.top
      const fromBottom = window.innerHeight - SCROLL_ZONE.bottom - clientY
      const speed =
        fromTop < 0
          ? Math.max(-MAX_SCROLL_SPEED, fromTop / 6)
          : fromBottom < 0
            ? Math.min(MAX_SCROLL_SPEED, -fromBottom / 6)
            : 0
      if (speed !== 0) {
        window.scrollBy(0, speed)
        update()
      }
      frame = requestAnimationFrame(scroll)
    })
    const onMove = (move: PointerEvent) => {
      clientY = move.clientY
      update()
    }
    const stop = () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onEnd)
      window.removeEventListener("pointercancel", onEnd)
      abandon.current = null
    }
    const onEnd = () => {
      stop()
      const to = dropIndex(from, current.pageY - startY, ids.length)
      if (to !== from) onReorder(moved(ids, from, to))
      setDrag(null)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onEnd)
    window.addEventListener("pointercancel", onEnd)
    abandon.current = stop
  }

  const offset = drag ? drag.pageY - drag.startY : 0
  const to = drag ? dropIndex(drag.from, offset, ids.length) : 0
  /** The order as it would be if the dragged row were released now. */
  const order = drag ? moved(ids, drag.from, to) : ids

  return (
    <ol className={cn("flex flex-col gap-2", drag && "select-none")}>
      {players.map((player, index) => {
        const dragged = drag?.id === player.id
        const seat = order.indexOf(player.id)
        // Rows the dragged one passes move one row towards its old place.
        const shift = dragged ? offset : (seat - index) * ROW_PITCH
        return (
          <li
            key={player.id}
            style={shift === 0 ? undefined : { translate: `0 ${shift}px` }}
            className={cn(
              "relative flex h-14 items-center gap-1 rounded-[14px] border-[1.5px] border-border bg-card pr-1",
              dragged
                ? "z-10 border-primary shadow-lg"
                : drag && "transition-[translate] duration-150",
              // The Dealer's badge hangs over the row below, so draw it on top.
              seat === 0 && !dragged && "z-[1]"
            )}
          >
            <button
              type="button"
              aria-label={`${player.name} verschieben, Platz ${index + 1}. Pfeiltasten hoch und runter`}
              className={cn(
                "flex size-11 shrink-0 touch-none items-center justify-center text-muted-foreground",
                dragged ? "cursor-grabbing" : "cursor-grab"
              )}
              onPointerDown={(event) => startDrag(player.id, event)}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") moveBy(player.id, -1)
                else if (event.key === "ArrowDown") moveBy(player.id, 1)
                else return
                event.preventDefault()
              }}
            >
              <GripVertical className="size-5" aria-hidden="true" />
            </button>
            <span className="w-6 shrink-0 text-center text-[15px] text-muted-foreground tabular-nums">
              {seat + 1}
            </span>
            <span className="ml-2 flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-[17px] font-semibold">
                {player.name}
              </span>
              {player.guest ? <GuestLabel /> : null}
            </span>
            <button
              type="button"
              onClick={() => onRemove(player.id)}
              aria-label={`${player.name} vom Tisch nehmen`}
              className="flex size-11 shrink-0 items-center justify-center text-muted-foreground"
            >
              <X className="size-5.5" aria-hidden="true" />
            </button>
            {seat === 0 ? <DealerBadge placement="corner" /> : null}
          </li>
        )
      })}
    </ol>
  )
}

/** `ids` with the one at `from` moved to `to`. */
function moved(ids: Array<string>, from: number, to: number) {
  const next = [...ids]
  const [id] = next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}

const guestErrors: Partial<Record<string, string>> = {
  invalidName: "Zwischen 1 und 30 Zeichen.",
  nameTaken: "In der Gruppe heißt schon jemand so.",
}

/** Adds a Guest to the Group and seats them at the table. */
function NewGuest({
  groupId,
  onAdded,
}: {
  groupId: string
  onAdded: (id: string) => void
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function add(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await addGuestFn({ data: { groupId, name } })
    if (result.ok) {
      await router.invalidate()
      onAdded(result.value.id)
      setName("")
    } else {
      setError(guestErrors[result.code] ?? "Das hat nicht geklappt.")
    }
    setPending(false)
  }

  return (
    <form onSubmit={add} noValidate className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <label htmlFor="new-guest" className="sr-only">
          Name des neuen Gastes
        </label>
        <TextInput
          id="new-guest"
          value={name}
          maxLength={30}
          placeholder="Neuer Gast, z. B. Lukas"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "new-guest-error" : undefined}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1"
        />
        <button
          type="submit"
          aria-label="Gast anlegen und an den Tisch setzen"
          disabled={pending || name.trim() === ""}
          className="flex size-13 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary disabled:opacity-40"
        >
          <Plus className="size-5.5" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      {error ? (
        <span id="new-guest-error" className="text-[13px] text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  )
}
