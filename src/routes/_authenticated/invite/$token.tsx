import { useState } from "react"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import {
  LinkGone,
  LinkGoneContent,
  LinkGoneDescription,
  LinkGoneFooter,
  LinkGoneTitle,
} from "@/components/link-gone"
import { PageFooter } from "@/components/page-footer"
import { PageHeader } from "@/components/page-header"
import { Section, SectionDescription, SectionTitle } from "@/components/section"
import { Button } from "@/components/ui/button"
import { FieldDescription, FieldError } from "@/components/ui/field"
import { Page } from "@/components/page"
import {
  RadioCard,
  RadioCardDescription,
  RadioCardTitle,
  RadioGroup,
} from "@/components/ui/radio-group"
import { gameCount } from "@/lib/plural"
import { inviteQuery, joined, queryKeys } from "@/lib/queries"
import { joinGroupFn } from "@/server/functions"
import type { InviteView } from "@/server/invites"

/**
 * Where an Invite link or QR code leads. Being below `_authenticated`, it
 * sends people without a session to sign in or sign up first and back here.
 */
export const Route = createFileRoute("/_authenticated/invite/$token")({
  loader: async ({ context, params }) => {
    const invite = await context.queryClient.query(inviteQuery(params.token))
    if (invite?.alreadyPlayer) {
      throw redirect({
        to: "/groups/$groupId",
        params: { groupId: invite.groupId },
      })
    }
  },
  component: InvitePage,
})

function InvitePage() {
  const { token } = Route.useParams()
  const { data: invite } = useSuspenseQuery(inviteQuery(token))
  return invite ? <AcceptInvite invite={invite} /> : <InvalidInvite />
}

const NEW_PLAYER = "new"

const joinErrors: Partial<Record<string, string>> = {
  guestNotFound:
    "Diesen Gast gibt es nicht mehr. Lade die Seite neu und wähle noch einmal.",
}

function AcceptInvite({ invite }: { invite: InviteView }) {
  const { token } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [choice, setChoice] = useState(NEW_PLAYER)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guest = invite.guests.find((g) => g.id === choice)

  async function join(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await joinGroupFn({
      data: { token, guestId: guest?.id },
    })
    if (!result.ok) {
      // A renewed Invite: the reloaded page says so.
      if (result.code === "inviteInvalid") {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.invite(token),
        })
        return
      }
      setPending(false)
      setError(joinErrors[result.code] ?? "Das hat nicht geklappt.")
      return
    }
    const { groupId } = result.value
    await joined(queryClient, token, groupId, { later: true })
    await navigate({ to: "/groups/$groupId", params: { groupId } })
  }

  return (
    <Page height="screen">
      <form onSubmit={join} className="flex min-h-0 flex-1 flex-col">
        <PageHeader variant="brand" />
        <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pt-4 pb-4">
          <Section className="gap-1.5">
            <SectionDescription>
              Einladung von {invite.invitedBy}
            </SectionDescription>
            <SectionTitle variant="page" as="h1">
              {invite.groupName}
            </SectionTitle>
            <SectionDescription>
              {invite.playerCount} Spieler, {gameCount(invite.gameCount)}
            </SectionDescription>
          </Section>

          {invite.guests.length > 0 ? (
            <Section aria-labelledby="who">
              <SectionTitle id="who" className="pb-2">
                Wer bist du?
              </SectionTitle>
              <RadioGroup
                aria-labelledby="who"
                value={choice}
                onValueChange={(value) => setChoice(value as string)}
                className="gap-2"
              >
                <RadioCard value={NEW_PLAYER}>
                  <RadioCardTitle>Ich bin neu hier</RadioCardTitle>
                  <RadioCardDescription>
                    Als neuer Spieler beitreten
                  </RadioCardDescription>
                </RadioCard>
                {invite.guests.map((g) => (
                  <RadioCard key={g.id} value={g.id}>
                    <RadioCardTitle>Ich bin {g.name}</RadioCardTitle>
                    <RadioCardDescription>
                      Gast, {gameCount(g.games)}
                    </RadioCardDescription>
                  </RadioCard>
                ))}
              </RadioGroup>
            </Section>
          ) : (
            <p className="text-pretty">
              Du trittst als neuer Spieler bei. Alle in der Gruppe sehen deinen
              Anzeigenamen und dein Profilbild, aber nicht deine E-Mail-Adresse.
            </p>
          )}
        </main>
        <PageFooter variant="bordered">
          {error ? (
            <FieldError>{error}</FieldError>
          ) : (
            <FieldDescription>
              {guest
                ? `${invite.invitedBy} bestätigt das. Danach gehören dir die bisherigen Spiele von ${guest.name}. Bis dahin bist du schon dabei.`
                : "Du bist sofort Spieler der Gruppe und siehst Spiele und Rangliste."}
            </FieldDescription>
          )}
          <Button type="submit" size="xl" disabled={pending}>
            {guest ? "Anfrage senden und beitreten" : "Beitreten"}
          </Button>
        </PageFooter>
      </form>
    </Page>
  )
}

function InvalidInvite() {
  return (
    <LinkGone>
      <LinkGoneContent>
        <LinkGoneTitle>Diese Einladung gilt nicht mehr</LinkGoneTitle>
        <LinkGoneDescription>
          Der Verwalter der Gruppe hat den Einladungslink erneuert. Bitte ihn um
          den aktuellen Link oder QR-Code.
        </LinkGoneDescription>
      </LinkGoneContent>
      <LinkGoneFooter>
        <Button size="xl" nativeButton={false} render={<Link to="/" />}>
          Zur Startseite
        </Button>
      </LinkGoneFooter>
    </LinkGone>
  )
}
