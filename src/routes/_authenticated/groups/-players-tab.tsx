import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { Badge } from "@/components/badge"
import { PrimaryButton, SecondaryButton } from "@/components/buttons"
import { TextInput } from "@/components/form-field"
import { UserAvatar } from "@/components/user-avatar"
import { groupChanged } from "@/lib/queries"
import { addGuestFn, confirmClaimFn, rejectClaimFn } from "@/server/functions"
import { mergeErrors } from "./-link-guest-sheet"
import type { GroupPlayer, GroupView } from "@/server/groups"
import type { GroupManagement } from "@/server/invites"

const guestErrors: Partial<Record<string, string>> = {
  invalidName: "Zwischen 1 und 30 Zeichen.",
  nameTaken: "In der Gruppe heißt schon jemand so.",
}

/**
 * Tab "Spieler": add a Guest, the Player list and, for the Group Admin
 * (`management`), open Claims. Linking a Guest is in "Gruppe verwalten".
 */
export function PlayersTab({
  group,
  management,
}: {
  group: GroupView
  management: GroupManagement | null
}) {
  const queryClient = useQueryClient()
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
      await groupChanged(queryClient, group.id)
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
            groupId={group.id}
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
            <PlayerRow player={p} />
          </li>
        ))}
      </ul>

      {group.formerPlayers.length > 0 ? (
        <Link
          to="/groups/$groupId/settings"
          params={{ groupId: group.id }}
          className="self-start py-1 text-[15px] text-muted-foreground"
        >
          {group.formerPlayers.length === 1
            ? "1 ehemaliger Spieler"
            : `${group.formerPlayers.length} ehemalige Spieler`}
        </Link>
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

/** An open Claim, for the Group Admin to confirm or reject. */
function ClaimCard({
  groupId,
  claimId,
  username,
  guest,
  games,
}: {
  groupId: string
  claimId: string
  username: string
  guest: string
  games: number
}) {
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: typeof confirmClaimFn) {
    setPending(true)
    setError(null)
    const result = await decision({ data: { claimId } })
    if (!result.ok) {
      setError(mergeErrors[result.code] ?? "Das hat nicht geklappt.")
    }
    // Also after a refusal: the Claim may be gone by now. A confirmed Claim
    // also renames the Guest in their past Games.
    await groupChanged(queryClient, groupId, { games: true })
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
