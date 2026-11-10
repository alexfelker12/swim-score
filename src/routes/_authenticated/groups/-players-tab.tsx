import { useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { Link as LinkIcon, Plus } from "lucide-react"
import { Badge } from "@/components/badge"
import { BottomSheet } from "@/components/bottom-sheet"
import { PrimaryButton, SecondaryButton } from "@/components/buttons"
import { ChoiceCard } from "@/components/choice-card"
import { TextInput } from "@/components/form-field"
import { UserAvatar } from "@/components/user-avatar"
import { gameCount } from "@/lib/plural"
import {
  addGuestFn,
  confirmClaimFn,
  linkGuestFn,
  rejectClaimFn,
} from "@/server/functions"
import type { GroupPlayer, GroupView } from "@/server/groups"
import type { GroupManagement } from "@/server/invites"

const guestErrors: Partial<Record<string, string>> = {
  invalidName: "Zwischen 1 und 30 Zeichen.",
  nameTaken: "In der Gruppe heißt schon jemand so.",
}

/**
 * Tab "Spieler": add a Guest, the Player list and, for the Group Admin
 * (`management`), open Claims and linking a Guest to an account.
 */
export function PlayersTab({
  group,
  management,
}: {
  group: GroupView
  management: GroupManagement | null
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [linking, setLinking] = useState<GroupPlayer | null>(null)

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

  const player = (id: string) => group.players.find((p) => p.id === id)
  const details = (id: string) => management?.players.find((p) => p.id === id)

  return (
    <div role="tabpanel" className="flex flex-col gap-3.5 px-4 pb-5">
      {management?.claims.map((claim) => {
        const guest = player(claim.guestId)
        const username = details(claim.playerId)?.username
        if (!guest || !username) return null
        return (
          <ClaimCard
            key={claim.id}
            claimId={claim.id}
            username={username}
            guest={guest.name}
            games={details(claim.guestId)?.games ?? 0}
          />
        )
      })}

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
        {group.players.map((p) => (
          <li key={p.id} className="border-b border-border">
            <PlayerRow
              player={p}
              onLink={management && p.guest ? () => setLinking(p) : undefined}
            />
          </li>
        ))}
      </ul>

      {linking && management ? (
        <LinkGuestSheet
          group={group}
          management={management}
          guest={linking}
          onClose={() => setLinking(null)}
        />
      ) : null}
    </div>
  )
}

/** What confirming a Claim does with the Guest's Games. */
function claimEffect(guest: string, games: number): string {
  if (games === 0) {
    return `Wenn du bestätigst, tritt dieses Konto an die Stelle von Gast ${guest}, der noch kein Spiel hat.`
  }
  return games === 1
    ? `Wenn du bestätigst, gehört das eine Spiel von Gast ${guest} ab jetzt diesem Konto.`
    : `Wenn du bestätigst, gehören die ${games} Spiele von Gast ${guest} ab jetzt diesem Konto.`
}

/** What linking a Guest directly does with the Guest's Games. */
function linkEffect(guest: string, games: number): string {
  if (games === 0) {
    return `Gast ${guest} hat noch kein Spiel und verschwindet aus der Liste.`
  }
  const moved =
    games === 1
      ? `Das eine Spiel von Gast ${guest} wird`
      : `Die ${games} Spiele von Gast ${guest} werden`
  return `${moved} mit diesem Spieler zusammengeführt, der Gast verschwindet aus der Liste.`
}

const mergeErrors: Partial<Record<string, string>> = {
  playedTogether:
    "Die beiden haben schon im selben Spiel gesessen, es sind also zwei Personen.",
  claimNotFound: "Diese Anfrage gibt es nicht mehr.",
  guestNotFound: "Diesen Gast gibt es nicht mehr.",
  playerNotFound: "Diesen Spieler gibt es nicht mehr.",
}

/** An open Claim, for the Group Admin to confirm or reject. */
function ClaimCard({
  claimId,
  username,
  guest,
  games,
}: {
  claimId: string
  username: string
  guest: string
  games: number
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: typeof confirmClaimFn) {
    setPending(true)
    setError(null)
    const result = await decision({ data: { claimId } })
    if (!result.ok) {
      setError(mergeErrors[result.code] ?? "Das hat nicht geklappt.")
    }
    // Also after a refusal: the Claim may be gone by now.
    await router.invalidate()
    setPending(false)
  }

  return (
    <section
      aria-labelledby={`claim-${claimId}`}
      className="flex flex-col gap-3 rounded-[14px] border-[1.5px] border-primary bg-card p-4"
    >
      <h2
        id={`claim-${claimId}`}
        className="text-sm font-semibold text-primary"
      >
        Offene Anfrage
      </h2>
      <p className="text-[17px] text-pretty wrap-break-word">
        <span className="font-semibold">{username}</span> sagt: „Ich bin {guest}
        “
      </p>
      <p className="text-sm text-pretty text-muted-foreground">
        {claimEffect(guest, games)} Prüf kurz am Tisch, ob es wirklich {guest}{" "}
        ist.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-pretty text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2.5">
        <SecondaryButton
          type="button"
          disabled={pending}
          onClick={() => decide(rejectClaimFn)}
          className="h-12 flex-1 bg-transparent text-base"
        >
          Ablehnen
        </SecondaryButton>
        <PrimaryButton
          type="button"
          disabled={pending}
          onClick={() => decide(confirmClaimFn)}
          className="h-12 flex-1 rounded-xl"
        >
          Bestätigen
        </PrimaryButton>
      </div>
    </section>
  )
}

/** "Emil mit Konto verknüpfen": the Group Admin picks the Player with an account the Guest is. */
function LinkGuestSheet({
  group,
  management,
  guest,
  onClose,
}: {
  group: GroupView
  management: GroupManagement
  guest: GroupPlayer
  onClose: () => void
}) {
  const router = useRouter()
  const [choice, setChoice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const details = (id: string) => management.players.find((p) => p.id === id)
  // The Group Admin links and is never the one linked.
  const accounts = group.players.filter((p) => !p.guest && !p.admin)

  async function merge(event: React.FormEvent) {
    event.preventDefault()
    if (!choice) return
    setPending(true)
    setError(null)
    const result = await linkGuestFn({
      data: { groupId: group.id, guestId: guest.id, playerId: choice },
    })
    if (!result.ok) {
      setPending(false)
      setError(mergeErrors[result.code] ?? "Das hat nicht geklappt.")
      return
    }
    await router.invalidate()
    onClose()
  }

  return (
    <BottomSheet
      title={`${guest.name} mit Konto verknüpfen`}
      description={`Wähle, wer ${guest.name} ist. ${linkEffect(guest.name, details(guest.id)?.games ?? 0)} Das lässt sich nicht rückgängig machen.`}
      onDismiss={onClose}
    >
      <form onSubmit={merge} className="flex min-h-0 flex-col gap-4">
        {accounts.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-pretty text-muted-foreground">
            Noch ist außer dir niemand mit Konto in der Gruppe. Sobald{" "}
            {guest.name} über die Einladung beigetreten ist, kannst du hier
            verknüpfen.
          </p>
        ) : (
          <fieldset className="flex max-h-[40svh] flex-col gap-2 overflow-auto">
            <legend className="sr-only">Spieler mit Konto</legend>
            {accounts.map((p) => {
              const info = details(p.id)
              // Someone who just joined is told apart by their Username.
              const fresh = info?.username && info.games === 0
              return (
                <ChoiceCard
                  key={p.id}
                  name="account"
                  value={p.id}
                  selected={choice}
                  onSelect={setChoice}
                  label={p.name}
                  note={
                    fresh
                      ? `${info.username}, ${gameCount(0)}`
                      : "Spieler mit Konto"
                  }
                />
              )
            })}
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
            Zusammenführen
          </PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  )
}

/** Rows with an account will open the Player Profile once it exists (#14). */
function PlayerRow({
  player,
  onLink,
}: {
  player: GroupPlayer
  /** Set for Guests when the Group Admin looks at the list. */
  onLink?: () => void
}) {
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
      {onLink ? (
        <button
          type="button"
          onClick={onLink}
          aria-label={`${player.name} mit Konto verknüpfen`}
          className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground"
        >
          <LinkIcon className="size-5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
