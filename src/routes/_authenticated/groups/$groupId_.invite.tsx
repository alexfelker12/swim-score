import { useState } from "react"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { LinkField } from "@/components/link-field"
import { PageFooter } from "@/components/page-footer"
import {
  PageHeader,
  PageHeaderBack,
  PageHeaderTitle,
} from "@/components/page-header"
import { QrCard, QrCode } from "@/components/qr-code"
import { Section, SectionDescription, SectionTitle } from "@/components/section"
import { Button } from "@/components/ui/button"
import { FieldDescription, FieldError } from "@/components/ui/field"
import { Page } from "@/components/page"
import { PageNotFound } from "@/components/page-not-found"
import {
  PageLoading,
  PageLoadingContent,
  PageLoadingHeader,
} from "@/components/page-loading"
import { Skeleton } from "@/components/ui/skeleton"
import { loadPageData } from "@/lib/page-data"
import { groupQuery, inviteLinkQuery } from "@/lib/queries"
import { useShareLink } from "@/lib/use-share-link"
import { renewInviteFn } from "@/server/functions"

/** "In die Gruppe einladen": the Group's Invite as QR code and link; Group Admin only. */
export const Route = createFileRoute("/_authenticated/groups/$groupId_/invite")(
  {
    loader: ({ context, params, cause }) =>
      loadPageData(cause, async () => {
        const [group, link] = await Promise.all([
          context.queryClient.query(groupQuery(params.groupId)),
          context.queryClient.query(inviteLinkQuery(params.groupId)),
        ])
        if (!group || !link) throw notFound()
      }),
    pendingComponent: InviteLoading,
    component: InvitePage,
  }
)

function InvitePage() {
  const { groupId } = Route.useParams()
  const group = useSuspenseQuery(groupQuery(groupId)).data
  const link = useSuspenseQuery(inviteLinkQuery(groupId)).data
  // Only the Group Admin of an existing Group gets the Invite.
  if (!group || !link) return <PageNotFound />
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
    <Page>
      <PageHeader>
        <PageHeaderBack
          icon="close"
          render={
            <Link
              to="/groups/$groupId"
              params={{ groupId }}
              search={{ tab: "players" }}
            />
          }
          label="Schließen"
        />
        <PageHeaderTitle>In die Gruppe einladen</PageHeaderTitle>
      </PageHeader>

      <main className="flex flex-1 flex-col px-5 pt-3">
        <Section align="center" className="gap-4.5">
          <SectionDescription>
            Am Tisch: Code scannen lassen. Sonst den Link schicken. Wer als Gast
            mitgespielt hat, kann sich darüber seinen Gast holen.
          </SectionDescription>
          <QrCard>
            {link.url ? (
              <QrCode
                text={link.url}
                label={`QR-Code der Einladung in die Gruppe ${groupName}`}
              />
            ) : null}
          </QrCard>
          <SectionTitle variant="lg">{groupName}</SectionTitle>
          <LinkField
            label="Einladungslink"
            shownUrl={link.shownUrl}
            copied={link.copied}
            onCopy={link.copy}
          />
          <FieldError>{error ?? link.error}</FieldError>
        </Section>
      </main>

      <PageFooter align="center">
        <Button size="xl" onClick={link.share} disabled={!link.url}>
          Link teilen
        </Button>
        <Button variant="ghost" onClick={renew} disabled={renewing}>
          Link erneuern
        </Button>
        <FieldDescription>
          Erneuern macht den alten Link und den alten Code ungültig.
        </FieldDescription>
      </PageFooter>
    </Page>
  )
}

/** While the Invite loads: QR code and link as placeholders. */
function InviteLoading() {
  return (
    <PageLoading>
      <PageLoadingHeader>
        <PageHeaderTitle>In die Gruppe einladen</PageHeaderTitle>
      </PageLoadingHeader>
      <PageLoadingContent className="items-center gap-2.5 px-5 pt-3">
        <Skeleton variant="line" className="h-4 w-72" />
        <Skeleton variant="line" className="h-4 w-64" />
        <Skeleton variant="card" className="mt-3 size-62" />
        <Skeleton variant="line" className="mt-3 h-6 w-48" />
        <Skeleton className="mt-2 h-12 self-stretch" />
      </PageLoadingContent>
    </PageLoading>
  )
}
