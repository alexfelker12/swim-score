import { useState } from "react"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { X } from "lucide-react"
import { PrimaryButton } from "@/components/buttons"
import { LinkField } from "@/components/link-field"
import { QrCode } from "@/components/qr-code"
import { groupQuery, inviteLinkQuery } from "@/lib/queries"
import { useShareLink } from "@/lib/use-share-link"
import { renewInviteFn } from "@/server/functions"

/** "In die Gruppe einladen": the Group's Invite as QR code and link; Group Admin only. */
export const Route = createFileRoute("/_authenticated/groups/$groupId_/invite")(
  {
    loader: async ({ context, params }) => {
      const [group, link] = await Promise.all([
        context.queryClient.query(groupQuery(params.groupId)),
        context.queryClient.query(inviteLinkQuery(params.groupId)),
      ])
      if (!group || !link) throw notFound()
    },
    component: InvitePage,
  }
)

function InvitePage() {
  const { groupId } = Route.useParams()
  const group = useSuspenseQuery(groupQuery(groupId)).data
  const link = useSuspenseQuery(inviteLinkQuery(groupId)).data
  // The loader lets only the Group Admin of an existing Group get here.
  if (!group || !link) return null
  return (
    <InviteLink groupId={groupId} groupName={group.name} token={link.token} />
  )
}

function InviteLink({
  groupId,
  groupName,
  token,
}: {
  groupId: string
  groupName: string
  token: string
}) {
  const queryClient = useQueryClient()
  const link = useShareLink(`/invite/${token}`, {
    title: `Einladung in die Gruppe ${groupName}`,
    text: `Komm in unsere Schwimmen-Gruppe „${groupName}“ bei Swim Score:`,
  })
  const [renewing, setRenewing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function renew() {
    setRenewing(true)
    setError(null)
    const result = await renewInviteFn({ data: { groupId } })
    if (result.ok) {
      // The server says what the new token is; nothing to load again.
      queryClient.setQueryData(inviteLinkQuery(groupId).queryKey, result.value)
    } else setError("Erneuern hat nicht geklappt.")
    setRenewing(false)
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[52px_minmax(0,1fr)_52px] items-center px-1">
        <Link
          to="/groups/$groupId"
          params={{ groupId }}
          search={{ tab: "players" }}
          aria-label="Schließen"
          className="flex size-11 items-center justify-center justify-self-center rounded-xl"
        >
          <X className="size-6" aria-hidden="true" />
        </Link>
        <h1 className="text-center text-[17px] font-semibold">
          In die Gruppe einladen
        </h1>
      </header>

      <main className="flex flex-1 flex-col gap-4.5 px-5 pt-3">
        <p className="text-center text-pretty text-muted-foreground">
          Am Tisch: Code scannen lassen. Sonst den Link schicken. Wer als Gast
          mitgespielt hat, kann sich darüber seinen Gast holen.
        </p>
        <div className="size-62 self-center rounded-[20px] bg-white p-4">
          {link.url ? (
            <QrCode
              text={link.url}
              label={`QR-Code der Einladung in die Gruppe ${groupName}`}
            />
          ) : null}
        </div>
        <div className="text-center text-xl font-bold wrap-break-word">
          {groupName}
        </div>
        <LinkField
          shownUrl={link.shownUrl}
          copied={link.copied}
          onCopy={link.copy}
        />
        <p role="status" className="text-center text-sm text-destructive">
          {error ?? link.error}
        </p>
      </main>

      <div className="flex flex-col gap-2.5 px-4 pt-4 pb-6">
        <PrimaryButton type="button" onClick={link.share} disabled={!link.url}>
          Link teilen
        </PrimaryButton>
        <button
          type="button"
          onClick={renew}
          disabled={renewing}
          className="h-12 rounded-[14px] text-[15px] font-medium disabled:opacity-40"
        >
          Link erneuern
        </button>
        <span className="text-center text-[13px] text-pretty text-muted-foreground">
          Erneuern macht den alten Link und den alten Code ungültig.
        </span>
      </div>
    </div>
  )
}
