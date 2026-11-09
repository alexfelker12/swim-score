import { useState } from "react"
import {
  Link,
  createFileRoute,
  notFound,
  useRouter,
} from "@tanstack/react-router"
import { ChevronLeft, Plus } from "lucide-react"
import { Badge } from "@/components/badge"
import { TextInput } from "@/components/form-field"
import { SegmentedTabs } from "@/components/segmented-tabs"
import { UserAvatar } from "@/components/user-avatar"
import { addGuestFn, getGroupFn } from "@/server/functions"
import type { GroupPlayer, GroupView } from "@/server/groups"

const TABS = ["games", "leaderboard", "players"] as const
type Tab = (typeof TABS)[number]

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
    TABS.includes(search.tab as Tab) ? { tab: search.tab as Tab } : {},
  loader: async ({ params }) => {
    const group = await getGroupFn({ data: { groupId: params.groupId } })
    if (!group) throw notFound()
    return group
  },
  component: GroupPage,
})

function GroupPage() {
  const group = Route.useLoaderData()
  const { tab = "games" } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <div className="flex min-h-svh flex-col">
      <header className="grid h-15 shrink-0 grid-cols-[52px_minmax(0,1fr)_52px] items-center px-1">
        <Link
          to="/"
          aria-label="Zur Startseite"
          className="flex size-11 items-center justify-center justify-self-center rounded-xl"
        >
          <ChevronLeft className="size-6" aria-hidden="true" />
        </Link>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl leading-tight font-bold">
            {group.name}
          </h1>
          <span className="text-[13px] text-muted-foreground">
            {group.players.length} Spieler
          </span>
        </div>
      </header>

      <SegmentedTabs
        label="Bereiche der Gruppe"
        value={tab}
        onChange={(next) => navigate({ search: { tab: next }, replace: true })}
        options={[
          { value: "games", label: "Spiele" },
          { value: "leaderboard", label: "Rangliste" },
          { value: "players", label: "Spieler" },
        ]}
        className="mx-4 mt-1 mb-3"
      />

      {tab === "players" ? (
        <Players group={group} />
      ) : (
        <div role="tabpanel" className="px-5 py-6 text-muted-foreground">
          {tab === "games"
            ? "Noch keine Spiele in dieser Gruppe."
            : "Die Rangliste erscheint, sobald ihr ein Spiel beendet habt."}
        </div>
      )}
    </div>
  )
}

const guestErrors: Partial<Record<string, string>> = {
  invalidName: "Zwischen 1 und 30 Zeichen.",
  nameTaken: "In der Gruppe heißt schon jemand so.",
}

function Players({ group }: { group: GroupView }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function add(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await addGuestFn({ data: { groupId: group.id, name } })
    if (result.ok) {
      setName("")
      await router.invalidate()
    } else {
      setError(guestErrors[result.code] ?? "Das hat nicht geklappt.")
    }
    setPending(false)
  }

  return (
    <div role="tabpanel" className="flex flex-col gap-3.5 px-4 pb-5">
      <form onSubmit={add} noValidate className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <label htmlFor="guest-name" className="sr-only">
            Name des Gastes
          </label>
          <TextInput
            id="guest-name"
            value={name}
            maxLength={30}
            placeholder="Gast hinzufügen, z. B. Lena"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "guest-error" : undefined}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1"
          />
          <button
            type="submit"
            aria-label="Gast hinzufügen"
            disabled={pending || name.trim() === ""}
            className="flex size-13 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary disabled:opacity-40"
          >
            <Plus className="size-5.5" strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        {error ? (
          <span id="guest-error" className="text-[13px] text-destructive">
            {error}
          </span>
        ) : null}
      </form>

      <ul className="flex flex-col">
        {group.players.map((player) => (
          <li key={player.id} className="border-b border-border">
            <PlayerRow player={player} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Rows with an account will open the Player Profile once it exists (#14). */
function PlayerRow({ player }: { player: GroupPlayer }) {
  return (
    <div className="flex min-h-14 items-center gap-3">
      {player.guest ? (
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-life-off text-[15px] font-semibold text-muted-foreground"
        >
          {player.name.charAt(0).toUpperCase()}
        </span>
      ) : (
        <UserAvatar
          name={player.name}
          image={player.image}
          size={36}
          className="border-[1.5px] border-life-off"
        />
      )}
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-[17px] font-medium">{player.name}</span>
        {player.me ? (
          <span className="text-[13px] text-muted-foreground">du</span>
        ) : null}
      </span>
      {player.admin ? <Badge tone="primary">Verwalter</Badge> : null}
      {player.guest ? <Badge tone="muted">Gast</Badge> : null}
    </div>
  )
}
