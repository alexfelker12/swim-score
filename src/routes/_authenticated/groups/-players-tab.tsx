import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { PersonAvatar } from "@/components/person-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardLabel,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
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
    <div className="flex flex-col gap-3.5 px-4 pb-5">
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

      <form onSubmit={add} noValidate>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="guest-name" className="sr-only">
            Name des Gastes
          </FieldLabel>
          <div className="flex gap-2">
            <Input
              id="guest-name"
              value={name}
              maxLength={30}
              placeholder="Gast hinzufügen, z. B. Lena"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "guest-error" : undefined}
              onChange={(e) => setName(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              variant="soft"
              size="icon-lg"
              aria-label="Gast hinzufügen"
              disabled={pending || name.trim() === ""}
            >
              <Plus />
            </Button>
          </div>
          <FieldError id="guest-error">{error}</FieldError>
        </Field>
      </form>

      <ItemGroup className="gap-0">
        {group.players.map((p) => (
          <PlayerRow key={p.id} player={p} />
        ))}
      </ItemGroup>

      {group.formerPlayers.length > 0 ? (
        <Button
          variant="muted"
          size="sm"
          nativeButton={false}
          render={
            <Link
              to="/groups/$groupId/settings"
              params={{ groupId: group.id }}
            />
          }
          className="-ml-3.5 self-start"
        >
          {group.formerPlayers.length === 1
            ? "1 ehemaliger Spieler"
            : `${group.formerPlayers.length} ehemalige Spieler`}
        </Button>
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
    <Card
      variant="primary"
      render={<section aria-labelledby={`claim-${claimId}`} />}
    >
      <CardLabel>
        <h2 id={`claim-${claimId}`}>Offene Anfrage</h2>
      </CardLabel>
      <CardTitle>
        {username} sagt: „Ich bin {guest}“
      </CardTitle>
      <CardDescription>
        {claimEffect(guest, games)} Prüf kurz am Tisch, ob es wirklich {guest}{" "}
        ist.
      </CardDescription>
      <FieldError>{error}</FieldError>
      <CardFooter>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => decide(rejectClaimFn)}
        >
          Ablehnen
        </Button>
        <Button disabled={pending} onClick={() => decide(confirmClaimFn)}>
          Bestätigen
        </Button>
      </CardFooter>
    </Card>
  )
}

/** A Player; with an account, the row opens their Player Profile. Guests are not tappable. */
function PlayerRow({ player }: { player: GroupPlayer }) {
  return (
    <div role="listitem">
      <Item
        variant="row"
        size="list"
        render={
          player.userId ? (
            <Link to="/players/$userId" params={{ userId: player.userId }} />
          ) : undefined
        }
      >
        <ItemMedia>
          <PersonAvatar
            variant={player.guest ? "guest" : "account"}
            name={player.name}
            image={player.image}
          />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            <span className="truncate">{player.name}</span>
            {player.me ? <Badge variant="plain">du</Badge> : null}
          </ItemTitle>
        </ItemContent>
        {player.admin ? <Badge variant="primary">Verwalter</Badge> : null}
        {player.guest ? <Badge variant="muted">Gast</Badge> : null}
      </Item>
    </div>
  )
}
