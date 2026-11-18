import { useEffect, useRef, useState } from "react"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
} from "@tanstack/react-router"
import { CircleAlert, Plus } from "lucide-react"
import { DealerBadge } from "@/components/dealer-badge"
import { PageFooter } from "@/components/page-footer"
import {
  PageHeader,
  PageHeaderBack,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/page-header"
import {
  SeatCandidate,
  SeatGrip,
  SeatList,
  SeatName,
  SeatNumber,
  SeatRemove,
  SeatRow,
} from "@/components/seating"
import { Section, SectionTitle } from "@/components/section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Page } from "@/components/page"
import { standardRuleSet } from "@/rules-engine"
import { groupChanged, newGameQuery } from "@/lib/queries"
import { addGuestFn, startGameFn } from "@/server/functions"
import type { NewGame } from "@/server/games"

export const Route = createFileRoute("/_authenticated/games/new")({
  validateSearch: (
    search: Record<string, unknown>
  ): { groupId: string; fromGame?: string } => ({
    groupId: typeof search.groupId === "string" ? search.groupId : "",
    // "Nochmal mit denselben Teilnehmern": seat them as in that Game.
    ...(typeof search.fromGame === "string"
      ? { fromGame: search.fromGame }
      : {}),
  }),
  loaderDeps: ({ search }) => ({
    groupId: search.groupId,
    fromGame: search.fromGame,
  }),
  // The form starts from the preselection it renders with; `query` loads
  // it again whenever it is stale or invalidated, e.g. by a Game started.
  loader: async ({ context, deps }) => {
    const setup = await context.queryClient.query(
      newGameQuery(deps.groupId, deps.fromGame)
    )
    if (!setup) throw notFound()
  },
  component: NewGamePage,
})

const { minParticipants, maxParticipants } = standardRuleSet
/** Row height plus gap; dragging moves a row one seat per this many pixels. */
const ROW_PITCH = 64

function NewGamePage() {
  const { groupId, fromGame } = Route.useSearch()
  const setup = useSuspenseQuery(newGameQuery(groupId, fromGame)).data
  if (!setup) return null
  // A new start (another Seating Order to begin from) starts the form afresh.
  return <NewGameForm key={fromGame ?? ""} groupId={groupId} setup={setup} />
}

function NewGameForm({ groupId, setup }: { groupId: string; setup: NewGame }) {
  const queryClient = useQueryClient()
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
    // The Group's Game list and the next preselection; the Game page loads
    // the Game itself.
    await groupChanged(queryClient, groupId, { later: true })
    await navigate({
      to: "/games/$gameId",
      params: { gameId: result.value.id },
    })
  }

  return (
    <Page>
      <PageHeader>
        <PageHeaderBack
          render={<Link to="/groups/$groupId" params={{ groupId }} />}
          label="Zurück zur Gruppe"
        />
        <PageHeaderContent>
          <PageHeaderTitle size="lg">Neues Spiel</PageHeaderTitle>
          <PageHeaderDescription>{setup.groupName}</PageHeaderDescription>
        </PageHeaderContent>
      </PageHeader>

      <main className="flex flex-1 flex-col gap-3 px-4 pt-2 pb-4">
        <Section aria-labelledby="seated" className="gap-3">
          <div className="mx-1 flex items-baseline justify-between">
            <SectionTitle id="seated">Am Tisch, im Uhrzeigersinn</SectionTitle>
            <Badge variant={problem ? "count-error" : "count"}>
              {seated.length}/{maxParticipants}
            </Badge>
          </div>
          <SeatingList
            players={seatedPlayers}
            onReorder={setSeated}
            onRemove={(id) => setSeated((now) => now.filter((s) => s !== id))}
          />
        </Section>

        <Section aria-labelledby="others" className="mt-4 gap-3">
          <SectionTitle id="others" className="mx-1">
            Nicht dabei
          </SectionTitle>
          <NewGuest
            groupId={groupId}
            onAdded={(id) => setSeated((now) => [...now, id])}
          />
          <ul className="flex flex-col gap-2">
            {others.map((player) => (
              <li key={player.id}>
                <SeatCandidate
                  name={player.name}
                  guest={player.guest}
                  onClick={() => setSeated((now) => [...now, player.id])}
                />
              </li>
            ))}
          </ul>
        </Section>
      </main>

      <PageFooter variant="sticky">
        {error || problem ? (
          <FieldError size="lg">
            <CircleAlert />
            {error ?? problem}
          </FieldError>
        ) : null}
        <Button
          size="xl"
          onClick={start}
          disabled={problem !== null || pending}
        >
          Spiel starten
        </Button>
      </PageFooter>
    </Page>
  )
}

function tooMany(count: number) {
  return count === 1 ? "1 Person" : `${count} Personen`
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
    <SeatList dragging={drag !== null}>
      {players.map((player, index) => {
        const dragged = drag?.id === player.id
        const seat = order.indexOf(player.id)
        // Rows the dragged one passes move one row towards its old place.
        const shift = dragged ? offset : (seat - index) * ROW_PITCH
        return (
          <SeatRow
            key={player.id}
            dragged={dragged}
            moving={drag !== null}
            first={seat === 0}
            style={shift === 0 ? undefined : { translate: `0 ${shift}px` }}
          >
            <SeatGrip
              label={`${player.name} verschieben, Platz ${index + 1}. Pfeiltasten hoch und runter`}
              dragged={dragged}
              onPointerDown={(event) => startDrag(player.id, event)}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") moveBy(player.id, -1)
                else if (event.key === "ArrowDown") moveBy(player.id, 1)
                else return
                event.preventDefault()
              }}
            />
            <SeatNumber>{seat + 1}</SeatNumber>
            <SeatName guest={player.guest} className="ml-2">
              {player.name}
            </SeatName>
            <SeatRemove
              label={`${player.name} vom Tisch nehmen`}
              onClick={() => onRemove(player.id)}
            />
            {seat === 0 ? <DealerBadge placement="corner" /> : null}
          </SeatRow>
        )
      })}
    </SeatList>
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
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function add(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await addGuestFn({ data: { groupId, name } })
    if (result.ok) {
      await groupChanged(queryClient, groupId)
      onAdded(result.value.id)
      setName("")
    } else {
      setError(guestErrors[result.code] ?? "Das hat nicht geklappt.")
    }
    setPending(false)
  }

  return (
    <form onSubmit={add} noValidate>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="new-guest" className="sr-only">
          Name des neuen Gastes
        </FieldLabel>
        <div className="flex gap-2">
          <Input
            id="new-guest"
            value={name}
            maxLength={30}
            placeholder="Neuer Gast, z. B. Lukas"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "new-guest-error" : undefined}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="soft"
            size="icon-lg"
            aria-label="Gast anlegen und an den Tisch setzen"
            disabled={pending || name.trim() === ""}
          >
            <Plus />
          </Button>
        </div>
        <FieldError id="new-guest-error">{error}</FieldError>
      </Field>
    </form>
  )
}
