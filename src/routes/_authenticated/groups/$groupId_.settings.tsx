import { useState } from "react"
import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import {
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  UserMinus,
} from "lucide-react"
import { BottomSheet } from "@/components/bottom-sheet"
import { PrimaryButton, SecondaryButton } from "@/components/buttons"
import { ChoiceCard } from "@/components/choice-card"
import { ConfirmSheet } from "@/components/confirm-sheet"
import { TextInput } from "@/components/form-field"
import { formatMonth, isToday } from "@/lib/dates"
import {
  getGroupFn,
  getGroupManagementFn,
  handOverAdminFn,
  leaveGroupFn,
  removePlayerFn,
  renameGroupFn,
} from "@/server/functions"
import { LinkGuestSheet } from "./-link-guest-sheet"
import type { FormerPlayer, GroupPlayer, GroupView } from "@/server/groups"
import type { GroupManagement } from "@/server/invites"

/**
 * "Gruppe verwalten" for the Group Admin, "Gruppe" for everyone else:
 * the Group's name, its Group Admin, Former Players and leaving.
 */
export const Route = createFileRoute(
  "/_authenticated/groups/$groupId_/settings"
)({
  loader: async ({ params }) => {
    const group = await getGroupFn({ data: params })
    if (!group) throw notFound()
    const management = group.isAdmin
      ? await getGroupManagementFn({ data: params })
      : null
    return { group, management }
  },
  component: SettingsPage,
})

const nameErrors: Partial<Record<string, string>> = {
  invalidName: "Zwischen 1 und 40 Zeichen.",
}

function SettingsPage() {
  const { group, management } = Route.useLoaderData()
  return (
    <div className="flex min-h-svh flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[52px_minmax(0,1fr)_52px] items-center px-1">
        <Link
          to="/groups/$groupId"
          params={{ groupId: group.id }}
          search={{ tab: "players" }}
          aria-label="Zurück zur Gruppe"
          className="flex size-11 items-center justify-center justify-self-center rounded-xl"
        >
          <ChevronLeft className="size-6" aria-hidden="true" />
        </Link>
        <h1 className="text-center text-[17px] font-semibold">
          {group.isAdmin ? "Gruppe verwalten" : "Gruppe"}
        </h1>
      </header>
      <main className="flex flex-col gap-7 px-4 pt-3 pb-8">
        {group.isAdmin && management ? (
          <AdminSettings group={group} management={management} />
        ) : (
          <MemberSettings group={group} />
        )}
      </main>
    </div>
  )
}

function AdminSettings({
  group,
  management,
}: {
  group: GroupView
  management: GroupManagement
}) {
  const [removing, setRemoving] = useState<GroupPlayer | null>(null)
  const [linking, setLinking] = useState<GroupPlayer | null>(null)
  const [handingOver, setHandingOver] = useState(false)
  return (
    <>
      <RenameForm group={group} />

      <section aria-labelledby="players" className="flex flex-col gap-1">
        <h2 id="players" className="text-[17px] font-semibold">
          Spieler
        </h2>
        <ul className="flex flex-col">
          {group.players.map((p) => (
            <li
              key={p.id}
              className="flex min-h-14 items-center gap-1 border-b border-border"
            >
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate text-[17px] font-medium">
                  {p.name}
                </span>
                <span className="truncate text-[13px] text-muted-foreground">
                  {playerTag(p)}
                </span>
              </span>
              {p.guest ? (
                <button
                  type="button"
                  onClick={() => setLinking(p)}
                  aria-label={`${p.name} mit Konto verknüpfen`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl text-primary"
                >
                  <LinkIcon className="size-5" aria-hidden="true" />
                </button>
              ) : null}
              {p.me ? null : (
                <button
                  type="button"
                  onClick={() => setRemoving(p)}
                  aria-label={`${p.name} entfernen`}
                  className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-destructive"
                >
                  <UserMinus className="size-5" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="pt-2 text-sm text-pretty text-muted-foreground">
          Entfernte Spieler bleiben in alten Spielen sichtbar, tauchen aber
          nicht mehr in der Spielerauswahl und der Rangliste auf.
        </p>
      </section>

      <section aria-labelledby="admin" className="flex flex-col gap-2.5">
        <h2 id="admin" className="text-[17px] font-semibold">
          Verwalter
        </h2>
        <p className="text-muted-foreground">Du verwaltest diese Gruppe.</p>
        <button
          type="button"
          onClick={() => setHandingOver(true)}
          className="flex h-14 items-center justify-between rounded-[14px] border-[1.5px] border-border bg-card px-4 text-left text-base font-medium"
        >
          Verwalterrolle übergeben
          <ChevronRight
            className="size-5 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
      </section>

      <FormerPlayers players={group.formerPlayers} />

      <section className="flex flex-col gap-2">
        <button
          type="button"
          disabled
          className="h-11 self-start text-[17px] font-semibold text-destructive disabled:opacity-40"
        >
          Gruppe verlassen
        </button>
        <p className="text-sm text-pretty text-muted-foreground">
          Als Verwalter übergibst du die Rolle zuerst an einen Spieler mit
          Konto.
        </p>
      </section>

      {removing ? (
        <RemoveSheet
          groupId={group.id}
          player={removing}
          onClose={() => setRemoving(null)}
        />
      ) : null}
      {linking ? (
        <LinkGuestSheet
          group={group}
          management={management}
          guest={linking}
          onClose={() => setLinking(null)}
        />
      ) : null}
      {handingOver ? (
        <HandOverSheet group={group} onClose={() => setHandingOver(false)} />
      ) : null}
    </>
  )
}

function MemberSettings({ group }: { group: GroupView }) {
  const [leaving, setLeaving] = useState(false)
  const admin = group.players.find((p) => p.admin)
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-[15px] text-muted-foreground">Name</span>
        <span className="text-[22px] font-semibold wrap-break-word">
          {group.name}
        </span>
      </div>

      {admin ? (
        <div className="flex flex-col gap-1">
          <span className="text-[15px] text-muted-foreground">Verwalter</span>
          <span className="text-xl font-semibold">{admin.name}</span>
          <p className="text-[15px] text-pretty text-muted-foreground">
            {admin.name} lädt neue Spieler ein und bestätigt, wer welcher Gast
            ist. Gäste kann jeder anlegen, auch direkt beim Spielstart.
          </p>
        </div>
      ) : null}

      <FormerPlayers players={group.formerPlayers} />

      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setLeaving(true)}
          className="h-11 self-start text-[17px] font-semibold text-destructive"
        >
          Gruppe verlassen
        </button>
        <p className="text-sm text-pretty text-muted-foreground">
          Deine bisherigen Spiele bleiben. In der Gruppe stehst du danach als
          ehemaliger Spieler. Zurück kommst du nur über eine neue Einladung.
        </p>
      </section>

      {leaving ? (
        <LeaveSheet group={group} onClose={() => setLeaving(false)} />
      ) : null}
    </>
  )
}

function RenameForm({ group }: { group: GroupView }) {
  const router = useRouter()
  const [name, setName] = useState(group.name)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = name.trim() !== group.name

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await renameGroupFn({ data: { groupId: group.id, name } })
    if (result.ok) await router.invalidate()
    else setError(nameErrors[result.code] ?? "Das hat nicht geklappt.")
    setPending(false)
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-1.5">
      <label htmlFor="group-name" className="text-sm font-medium">
        Name
      </label>
      <div className="flex gap-2">
        <TextInput
          id="group-name"
          value={name}
          maxLength={40}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "group-name-error" : undefined}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={pending || !changed}
          className="h-13 shrink-0 rounded-xl bg-primary-muted px-4 text-base font-semibold text-primary disabled:opacity-40"
        >
          Speichern
        </button>
      </div>
      {error ? (
        <span id="group-name-error" className="text-[13px] text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  )
}

function FormerPlayers({ players }: { players: Array<FormerPlayer> }) {
  if (players.length === 0) return null
  return (
    <section aria-labelledby="former" className="flex flex-col gap-1">
      <h2 id="former" className="text-[17px] font-semibold">
        Ehemalige Spieler
      </h2>
      <ul className="flex flex-col">
        {players.map((p) => (
          <li
            key={p.id}
            className="flex min-h-13 items-center justify-between gap-3 border-b border-border"
          >
            <span className="truncate">{p.name}</span>
            <span className="shrink-0 text-[15px] text-muted-foreground">
              {leftLabel(p)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** "Ben entfernen?": the Player becomes a Former Player. */
function RemoveSheet({
  groupId,
  player,
  onClose,
}: {
  groupId: string
  player: GroupPlayer
  onClose: () => void
}) {
  const router = useRouter()

  async function remove() {
    const result = await removePlayerFn({
      data: { groupId, playerId: player.id },
    })
    if (!result.ok) {
      return result.code === "playerNotFound"
        ? `${player.name} ist schon nicht mehr in der Gruppe.`
        : "Das hat nicht geklappt."
    }
    await router.invalidate()
    onClose()
  }

  return (
    <ConfirmSheet
      title={`${player.name} entfernen?`}
      description={`${player.name} wird ehemaliger Spieler. Alte Spiele bleiben unverändert, in Spielerauswahl und Rangliste taucht ${player.name} nicht mehr auf.`}
      confirmLabel="Entfernen"
      onConfirm={remove}
      onClose={onClose}
    />
  )
}

/** "Verwalterrolle übergeben": pick another Player with an account. */
function HandOverSheet({
  group,
  onClose,
}: {
  group: GroupView
  onClose: () => void
}) {
  const router = useRouter()
  const [choice, setChoice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accounts = group.players.filter((p) => !p.guest && !p.me)

  async function handOver(event: React.FormEvent) {
    event.preventDefault()
    if (!choice) return
    setPending(true)
    setError(null)
    const result = await handOverAdminFn({
      data: { groupId: group.id, playerId: choice },
    })
    if (!result.ok) {
      setPending(false)
      setError(
        result.code === "playerNotFound"
          ? "Diesen Spieler gibt es in der Gruppe nicht mehr."
          : "Das hat nicht geklappt."
      )
      return
    }
    // The page reloads as "Gruppe", without the Group Admin's tools.
    await router.invalidate()
    onClose()
  }

  return (
    <BottomSheet
      title="Verwalterrolle übergeben"
      description="Wähle, wer die Gruppe ab jetzt verwaltet. Du bleibst Spieler der Gruppe."
      onDismiss={onClose}
    >
      <form onSubmit={handOver} className="flex min-h-0 flex-col gap-4">
        {accounts.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-pretty text-muted-foreground">
            Noch ist außer dir niemand mit Konto in der Gruppe. Lade jemanden
            ein, dann kannst du die Rolle übergeben.
          </p>
        ) : (
          <fieldset className="flex max-h-[40svh] flex-col gap-2 overflow-auto">
            <legend className="sr-only">Spieler mit Konto</legend>
            {accounts.map((p) => (
              <ChoiceCard
                key={p.id}
                name="admin"
                value={p.id}
                selected={choice}
                onSelect={setChoice}
                label={p.name}
                note="Spieler mit Konto"
              />
            ))}
          </fieldset>
        )}
        {error ? (
          <p role="alert" className="text-sm text-pretty text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2.5">
          <SecondaryButton
            type="button"
            onClick={onClose}
            className="h-13 flex-1 rounded-[14px] bg-transparent text-base"
          >
            Abbrechen
          </SecondaryButton>
          <PrimaryButton
            type="submit"
            disabled={pending || !choice}
            className="h-13 flex-1"
          >
            Übergeben
          </PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  )
}

/** "Gruppe verlassen?": the signed-in account becomes a Former Player. */
function LeaveSheet({
  group,
  onClose,
}: {
  group: GroupView
  onClose: () => void
}) {
  const navigate = useNavigate()

  async function leave() {
    const result = await leaveGroupFn({ data: { groupId: group.id } })
    if (!result.ok) {
      return result.code === "adminCannotLeave"
        ? "Du verwaltest die Gruppe inzwischen. Übergib die Rolle zuerst."
        : "Das hat nicht geklappt."
    }
    await navigate({ to: "/" })
  }

  return (
    <ConfirmSheet
      title="Gruppe verlassen?"
      description={`In ${group.name} stehst du danach als ehemaliger Spieler. Deine bisherigen Spiele bleiben. Zurück kommst du nur über eine neue Einladung.`}
      confirmLabel="Verlassen"
      onConfirm={leave}
      onClose={onClose}
    />
  )
}

/** "du, Verwalter", "seit heute dabei", "Gast, von Ben angelegt" … */
function playerTag(p: GroupPlayer): string {
  if (p.guest) return p.addedBy ? `Gast, von ${p.addedBy} angelegt` : "Gast"
  const tags = [
    p.me ? "du" : null,
    p.admin ? "Verwalter" : null,
    !p.me && isToday(p.joinedAt) ? "seit heute dabei" : null,
  ]
  return tags.filter(Boolean).join(", ")
}

/** "ausgetreten im September", "entfernt im Oktober 2025", "Konto gelöscht". */
function leftLabel(p: FormerPlayer): string {
  if (p.reason === "deleted") return "Konto gelöscht"
  const when = formatMonth(p.leftAt)
  return p.reason === "left" ? `ausgetreten im ${when}` : `entfernt im ${when}`
}
