import { useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { BottomSheet } from "@/components/bottom-sheet"
import { PrimaryButton, SecondaryButton } from "@/components/buttons"
import { ChoiceCard } from "@/components/choice-card"
import { gameCount } from "@/lib/plural"
import { linkGuestFn } from "@/server/functions"
import type { GroupPlayer, GroupView } from "@/server/groups"
import type { GroupManagement } from "@/server/invites"

/** What a refused merge (Claim or direct link) tells the Group Admin. */
export const mergeErrors: Partial<Record<string, string>> = {
  playedTogether:
    "Die beiden haben schon im selben Spiel gesessen, es sind also zwei Personen.",
  claimNotFound: "Diese Anfrage gibt es nicht mehr.",
  guestNotFound: "Diesen Gast gibt es nicht mehr.",
  playerNotFound: "Diesen Spieler gibt es nicht mehr.",
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

export /** "Emil mit Konto verknüpfen": the Group Admin picks the Player with an account the Guest is. */
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
