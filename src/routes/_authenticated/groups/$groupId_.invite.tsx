import { useEffect, useMemo, useState } from "react"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { X } from "lucide-react"
import qrcode from "qrcode-generator"
import { PrimaryButton } from "@/components/buttons"
import { groupQuery, inviteLinkQuery } from "@/lib/queries"
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
  // The link carries this site's address, which only the browser knows for sure.
  const [origin, setOrigin] = useState<string | null>(null)
  useEffect(() => setOrigin(window.location.origin), [])
  const url = origin ? `${origin}/invite/${token}` : null
  const [copied, setCopied] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Kopieren hat nicht geklappt. Markiere den Link von Hand.")
    }
  }

  async function share() {
    if (!url) return
    if (!("share" in navigator)) return copy()
    try {
      await navigator.share({
        title: `Einladung in die Gruppe ${groupName}`,
        text: `Komm in unsere Schwimmen-Gruppe „${groupName}“ bei Swim Score:`,
        url,
      })
    } catch {
      // Closing the share sheet is not an error.
    }
  }

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
          {url ? (
            <QrCode
              text={url}
              label={`QR-Code der Einladung in die Gruppe ${groupName}`}
            />
          ) : null}
        </div>
        <div className="text-center text-xl font-bold wrap-break-word">
          {groupName}
        </div>
        <div className="flex h-13 items-center gap-2 rounded-xl bg-muted pr-1.5 pl-3.5">
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground select-all">
            {url?.replace(/^https?:\/\//, "")}
          </span>
          <button
            type="button"
            onClick={copy}
            disabled={!url}
            className="h-10 shrink-0 rounded-[10px] bg-card px-3 text-sm font-medium"
          >
            {copied ? "Kopiert" : "Kopieren"}
          </button>
        </div>
        <p role="status" className="text-center text-sm text-destructive">
          {error}
        </p>
      </main>

      <div className="flex flex-col gap-2.5 px-4 pt-4 pb-6">
        <PrimaryButton type="button" onClick={share} disabled={!url}>
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

/** A QR code as one SVG path; dark on the white card in both themes so cameras read it. */
function QrCode({ text, label }: { text: string; label: string }) {
  const { size, path } = useMemo(() => {
    const code = qrcode(0, "M")
    code.addData(text)
    code.make()
    const count = code.getModuleCount()
    let d = ""
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (code.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`
      }
    }
    return { size: count, path: d }
  }, [text])
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="size-full fill-black"
    >
      <path d={path} />
    </svg>
  )
}
