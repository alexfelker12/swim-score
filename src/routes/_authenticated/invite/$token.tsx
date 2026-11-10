import { useState } from "react"
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { Unlink } from "lucide-react"
import { PrimaryButton, primaryButtonClass } from "@/components/buttons"
import { ChoiceCard } from "@/components/choice-card"
import { Logo } from "@/components/logo"
import { gameCount } from "@/lib/plural"
import { getInviteFn, joinGroupFn } from "@/server/functions"
import type { InviteView } from "@/server/invites"

/**
 * Where an Invite link or QR code leads. Being below `_authenticated`, it
 * sends people without a session to sign in or sign up first and back here.
 */
export const Route = createFileRoute("/_authenticated/invite/$token")({
  loader: async ({ params }) => {
    const invite = await getInviteFn({ data: { token: params.token } })
    if (invite?.alreadyPlayer) {
      throw redirect({
        to: "/groups/$groupId",
        params: { groupId: invite.groupId },
      })
    }
    return { invite }
  },
  component: InvitePage,
})

function InvitePage() {
  const { invite } = Route.useLoaderData()
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
  const router = useRouter()
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
      if (result.code === "inviteInvalid") return router.invalidate()
      setPending(false)
      setError(joinErrors[result.code] ?? "Das hat nicht geklappt.")
      return
    }
    await navigate({
      to: "/groups/$groupId",
      params: { groupId: result.value.groupId },
    })
  }

  return (
    <form onSubmit={join} className="flex h-svh flex-col">
      <header className="flex h-16 shrink-0 items-center px-5">
        <Logo />
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pt-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[15px] text-muted-foreground">
            Einladung von {invite.invitedBy}
          </span>
          <h1 className="text-[30px] leading-[1.15] font-bold wrap-break-word">
            {invite.groupName}
          </h1>
          <span className="text-[15px] text-muted-foreground">
            {invite.playerCount} Spieler, {gameCount(invite.gameCount)}
          </span>
        </div>

        {invite.guests.length > 0 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="pb-2 text-[17px] font-semibold">
              Wer bist du?
            </legend>
            <ChoiceCard
              name="who"
              value={NEW_PLAYER}
              selected={choice}
              onSelect={setChoice}
              label="Ich bin neu hier"
              note="Als neuer Spieler beitreten"
            />
            {invite.guests.map((g) => (
              <ChoiceCard
                name="who"
                key={g.id}
                value={g.id}
                selected={choice}
                onSelect={setChoice}
                label={`Ich bin ${g.name}`}
                note={`Gast, ${gameCount(g.games)}`}
              />
            ))}
          </fieldset>
        ) : (
          <p className="text-pretty">
            Du trittst als neuer Spieler bei. Alle in der Gruppe sehen deinen
            Anzeigenamen und dein Profilbild, aber nicht deine E-Mail-Adresse.
          </p>
        )}
      </main>
      <div className="flex shrink-0 flex-col gap-2.5 border-t border-border px-4 pt-4 pb-6">
        {error ? (
          <p role="alert" className="text-sm text-pretty text-destructive">
            {error}
          </p>
        ) : (
          <p className="text-sm text-pretty text-muted-foreground">
            {guest
              ? `${invite.invitedBy} bestätigt das. Danach gehören dir die bisherigen Spiele von ${guest.name}. Bis dahin bist du schon dabei.`
              : "Du bist sofort Spieler der Gruppe und siehst Spiele und Rangliste."}
          </p>
        )}
        <PrimaryButton type="submit" disabled={pending}>
          {guest ? "Anfrage senden und beitreten" : "Beitreten"}
        </PrimaryButton>
      </div>
    </form>
  )
}

function InvalidInvite() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center px-5">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col justify-center gap-3.5 px-7 pb-20">
        <div className="flex items-center gap-3">
          <Unlink
            className="size-8 shrink-0 text-muted-foreground"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <h1 className="text-[26px] leading-[1.2] font-bold text-balance">
            Diese Einladung gilt nicht mehr
          </h1>
        </div>
        <p className="text-pretty text-muted-foreground">
          Der Verwalter der Gruppe hat den Einladungslink erneuert. Bitte ihn um
          den aktuellen Link oder QR-Code.
        </p>
      </main>
      <div className="px-4 pb-6">
        <Link to="/" className={primaryButtonClass}>
          Zur Startseite
        </Link>
      </div>
    </div>
  )
}
