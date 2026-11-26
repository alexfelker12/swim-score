import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerForm,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { FieldError } from "@/components/ui/field"
import {
  RadioCard,
  RadioCardDescription,
  RadioCardTitle,
  RadioGroup,
} from "@/components/ui/radio-group"
import { gameCount } from "@/lib/plural"
import { useSheet } from "@/lib/use-sheet"
import { groupChanged } from "@/lib/queries"
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

/**
 * "Emil mit Konto verknüpfen": the Group Admin picks the Player with an
 * account the Guest is. Opens when mounted; `onClose` runs once it has
 * closed.
 */
export function LinkGuestSheet({
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
  const queryClient = useQueryClient()
  const sheet = useSheet(onClose)
  const [choice, setChoice] = useState<string | null>(null)
  const details = (id: string) => management.players.find((p) => p.id === id)
  // The Group Admin links and is never the one linked.
  const accounts = group.players.filter((p) => !p.guest && !p.admin)

  async function merge(playerId: string) {
    const result = await linkGuestFn({
      data: { groupId: group.id, guestId: guest.id, playerId },
    })
    if (!result.ok) return mergeErrors[result.code] ?? "Das hat nicht geklappt."
    // The Guest's name in their past Games changes too.
    await groupChanged(queryClient, group.id, { games: true })
  }

  return (
    <Drawer {...sheet.drawer}>
      <DrawerContent scroll="body">
        <DrawerForm
          onSubmit={(event) => {
            event.preventDefault()
            if (choice) void sheet.run(() => merge(choice))
          }}
        >
          <DrawerHeader>
            <DrawerTitle>{guest.name} mit Konto verknüpfen</DrawerTitle>
            <DrawerDescription>
              Wähle, wer {guest.name} ist.{" "}
              {linkEffect(guest.name, details(guest.id)?.games ?? 0)} Das lässt
              sich nicht rückgängig machen.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            {accounts.length === 0 ? (
              <Alert>
                <Info />
                <AlertDescription>
                  Noch ist außer dir niemand mit Konto in der Gruppe. Sobald{" "}
                  {guest.name} über die Einladung beigetreten ist, kannst du
                  hier verknüpfen.
                </AlertDescription>
              </Alert>
            ) : (
              <RadioGroup
                aria-label="Spieler mit Konto"
                value={choice}
                onValueChange={(value) => setChoice(value as string)}
                className="gap-2"
              >
                {accounts.map((p) => {
                  const info = details(p.id)
                  // Someone who just joined is told apart by their Username.
                  const fresh = info?.username && info.games === 0
                  return (
                    <RadioCard key={p.id} value={p.id}>
                      <RadioCardTitle>{p.name}</RadioCardTitle>
                      <RadioCardDescription>
                        {fresh
                          ? `${info.username}, ${gameCount(0)}`
                          : "Spieler mit Konto"}
                      </RadioCardDescription>
                    </RadioCard>
                  )
                })}
              </RadioGroup>
            )}
          </DrawerBody>
          <FieldError>{sheet.error}</FieldError>
          <DrawerFooter orientation="horizontal">
            <DrawerClose
              render={<Button variant="secondary" size="lg" />}
              disabled={sheet.pending}
            >
              Abbrechen
            </DrawerClose>
            <Button type="submit" size="lg" disabled={sheet.pending || !choice}>
              Zusammenführen
            </Button>
          </DrawerFooter>
        </DrawerForm>
      </DrawerContent>
    </Drawer>
  )
}
