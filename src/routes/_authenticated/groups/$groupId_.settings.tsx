import { useState } from "react"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
} from "@tanstack/react-router"
import {
  ChevronRight,
  Info,
  Link as LinkIcon,
  LogOut,
  UserMinus,
} from "lucide-react"
import {
  PageHeader,
  PageHeaderBack,
  PageHeaderTitle,
} from "@/components/page-header"
import { Section, SectionDescription, SectionTitle } from "@/components/section"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PersonAvatar } from "@/components/person-avatar"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  RadioCard,
  RadioCardDescription,
  RadioCardTitle,
  RadioGroup,
} from "@/components/ui/radio-group"
import { formatMonth, isToday } from "@/lib/dates"
import {
  groupChanged,
  groupManagementQuery,
  groupQuery,
  leftGroup,
} from "@/lib/queries"
import { useManagement } from "./-use-management"
import { useSheet } from "@/lib/use-sheet"
import {
  handOverAdminFn,
  leaveGroupFn,
  removePlayerFn,
  renameGroupFn,
} from "@/server/functions"
import { LinkGuestSheet } from "./-link-guest-sheet"
import type { FormerPlayer, GroupPlayer, GroupView } from "@/server/groups"
import type { GroupManagement } from "@/server/invites"

/**
 * "Gruppe verwalten" for the Group Admin, "Gruppe" for everyone else:
 * the Group's name, its Group Admin, Former Players and leaving.
 */
export const Route = createFileRoute(
  "/_authenticated/groups/$groupId_/settings"
)({
  loader: async ({ context, params }) => {
    const group = await context.queryClient.query(groupQuery(params.groupId))
    if (!group) throw notFound()
    if (group.isAdmin) {
      await context.queryClient.query(groupManagementQuery(params.groupId))
    }
  },
  component: SettingsPage,
})

const nameErrors: Partial<Record<string, string>> = {
  invalidName: "Zwischen 1 und 40 Zeichen.",
}

function SettingsPage() {
  const { groupId } = Route.useParams()
  const group = useSuspenseQuery(groupQuery(groupId)).data
  const management = useManagement(groupId, group?.isAdmin ?? false)
  if (!group) return null
  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader>
        <PageHeaderBack
          render={
            <Link
              to="/groups/$groupId"
              params={{ groupId: group.id }}
              search={{ tab: "players" }}
            />
          }
          label="Zurück zur Gruppe"
        />
        <PageHeaderTitle>
          {group.isAdmin ? "Gruppe verwalten" : "Gruppe"}
        </PageHeaderTitle>
      </PageHeader>
      <main className="flex flex-col gap-7 px-4 pt-3 pb-8">
        {group.isAdmin && management ? (
          <AdminSettings group={group} management={management} />
        ) : (
          <MemberSettings group={group} />
        )}
      </main>
    </div>
  )
}

function AdminSettings({
  group,
  management,
}: {
  group: GroupView
  management: GroupManagement
}) {
  const [removing, setRemoving] = useState<GroupPlayer | null>(null)
  const [linking, setLinking] = useState<GroupPlayer | null>(null)
  const [handingOver, setHandingOver] = useState(false)
  return (
    <>
      <RenameForm group={group} />

      <Section aria-labelledby="players" className="gap-1">
        <SectionTitle id="players">Spieler</SectionTitle>
        <ItemGroup className="gap-0">
          {group.players.map((p) => (
            <Item key={p.id} variant="row" size="list" role="listitem">
              <ItemMedia>
                <PersonAvatar
                  variant={p.guest ? "guest" : "account"}
                  name={p.name}
                  image={p.image}
                />
              </ItemMedia>
              <ItemContent className="min-w-0 gap-0.5">
                <ItemTitle>
                  <span className="truncate">{p.name}</span>
                </ItemTitle>
                <PlayerTag player={p} />
              </ItemContent>
              <ItemActions className="-mr-2 gap-0">
                {p.guest ? (
                  <Button
                    variant="primary-ghost"
                    size="icon"
                    onClick={() => setLinking(p)}
                    aria-label={`${p.name} mit Konto verknüpfen`}
                  >
                    <LinkIcon />
                  </Button>
                ) : null}
                {p.me ? null : (
                  <Button
                    variant="destructive-ghost"
                    size="icon"
                    onClick={() => setRemoving(p)}
                    aria-label={`${p.name} entfernen`}
                  >
                    <UserMinus />
                  </Button>
                )}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
        <SectionDescription className="pt-2">
          Entfernte Spieler bleiben in alten Spielen sichtbar, tauchen aber
          nicht mehr in der Spielerauswahl und der Rangliste auf.
        </SectionDescription>
      </Section>

      <Section aria-labelledby="admin" className="gap-2.5">
        <SectionTitle id="admin">Verwalter</SectionTitle>
        <SectionDescription>Du verwaltest diese Gruppe.</SectionDescription>
        <Button
          variant="outline"
          size="xl"
          onClick={() => setHandingOver(true)}
          className="justify-between"
        >
          Verwalterrolle übergeben
          <ChevronRight />
        </Button>
      </Section>

      <FormerPlayers players={group.formerPlayers} />

      <LeaveAction disabled>
        Als Verwalter übergibst du die Rolle zuerst an einen Spieler mit Konto.
      </LeaveAction>

      {removing ? (
        <RemoveSheet
          groupId={group.id}
          player={removing}
          onClose={() => setRemoving(null)}
        />
      ) : null}
      {linking ? (
        <LinkGuestSheet
          group={group}
          management={management}
          guest={linking}
          onClose={() => setLinking(null)}
        />
      ) : null}
      {handingOver ? (
        <HandOverSheet group={group} onClose={() => setHandingOver(false)} />
      ) : null}
    </>
  )
}

function MemberSettings({ group }: { group: GroupView }) {
  const [leaving, setLeaving] = useState(false)
  const admin = group.players.find((p) => p.admin)
  return (
    <>
      <Field>
        <FieldLabel htmlFor="group-name">Name</FieldLabel>
        <Input id="group-name" value={group.name} readOnly />
      </Field>

      {admin ? (
        <Section aria-labelledby="admin">
          <SectionTitle id="admin">Verwalter</SectionTitle>
          <SectionDescription>
            <strong>{admin.name}</strong> lädt neue Spieler ein und bestätigt,
            wer welcher Gast ist. Gäste kann jeder anlegen, auch direkt beim
            Spielstart.
          </SectionDescription>
        </Section>
      ) : null}

      <FormerPlayers players={group.formerPlayers} />

      <LeaveAction onClick={() => setLeaving(true)}>
        Deine bisherigen Spiele bleiben. In der Gruppe stehst du danach als
        ehemaliger Spieler. Zurück kommst du nur über eine neue Einladung.
      </LeaveAction>

      {leaving ? (
        <LeaveSheet group={group} onClose={() => setLeaving(false)} />
      ) : null}
    </>
  )
}

/** "Gruppe verlassen" with what it means under it. */
function LeaveAction({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="destructive-outline"
        size="lg"
        disabled={disabled}
        onClick={onClick}
      >
        <LogOut />
        Gruppe verlassen
      </Button>
      <FieldDescription>{children}</FieldDescription>
    </div>
  )
}

function RenameForm({ group }: { group: GroupView }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(group.name)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = name.trim() !== group.name

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await renameGroupFn({ data: { groupId: group.id, name } })
    // The name also shows in the Group's Games.
    if (result.ok) await groupChanged(queryClient, group.id, { games: true })
    else setError(nameErrors[result.code] ?? "Das hat nicht geklappt.")
    setPending(false)
  }

  return (
    <form onSubmit={save} noValidate>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="group-name">Name</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="group-name"
            value={name}
            maxLength={40}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "group-name-error" : undefined}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="soft"
            size="lg"
            disabled={pending || !changed}
          >
            Speichern
          </Button>
        </div>
        <FieldError id="group-name-error">{error}</FieldError>
      </Field>
    </form>
  )
}

function FormerPlayers({ players }: { players: Array<FormerPlayer> }) {
  if (players.length === 0) return null
  return (
    <Section aria-labelledby="former" className="gap-1">
      <SectionTitle id="former">Ehemalige Spieler</SectionTitle>
      <ItemGroup className="gap-0">
        {players.map((p) => (
          <Item key={p.id} variant="row" size="list" role="listitem">
            <ItemContent className="min-w-0 gap-0.5">
              <ItemTitle>
                <span className="truncate">{p.name}</span>
              </ItemTitle>
              <ItemDescription>{leftLabel(p)}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </Section>
  )
}

/** "Ben entfernen?": the Player becomes a Former Player. */
function RemoveSheet({
  groupId,
  player,
  onClose,
}: {
  groupId: string
  player: GroupPlayer
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const sheet = useSheet(onClose)

  async function remove() {
    const result = await removePlayerFn({
      data: { groupId, playerId: player.id },
    })
    if (!result.ok) {
      return result.code === "playerNotFound"
        ? `${player.name} ist schon nicht mehr in der Gruppe.`
        : "Das hat nicht geklappt."
    }
    await groupChanged(queryClient, groupId)
  }

  return (
    <Drawer {...sheet.drawer}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{player.name} entfernen?</DrawerTitle>
          <DrawerDescription>
            {player.name} wird ehemaliger Spieler. Alte Spiele bleiben
            unverändert, in Spielerauswahl und Rangliste taucht {player.name}{" "}
            nicht mehr auf.
          </DrawerDescription>
        </DrawerHeader>
        <FieldError>{sheet.error}</FieldError>
        <DrawerFooter>
          <Button
            variant="destructive"
            size="xl"
            disabled={sheet.pending}
            onClick={() => void sheet.run(remove)}
          >
            Entfernen
          </Button>
          <DrawerClose
            render={<Button variant="secondary" size="xl" />}
            disabled={sheet.pending}
          >
            Abbrechen
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

/** "Verwalterrolle übergeben": pick another Player with an account. */
function HandOverSheet({
  group,
  onClose,
}: {
  group: GroupView
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const sheet = useSheet(onClose)
  const [choice, setChoice] = useState<string | null>(null)
  const accounts = group.players.filter((p) => !p.guest && !p.me)

  async function handOver(playerId: string) {
    const result = await handOverAdminFn({
      data: { groupId: group.id, playerId },
    })
    if (!result.ok) {
      return result.code === "playerNotFound"
        ? "Diesen Spieler gibt es in der Gruppe nicht mehr."
        : "Das hat nicht geklappt."
    }
    // The page reloads as "Gruppe", without the Group Admin's tools.
    await groupChanged(queryClient, group.id)
  }

  return (
    <Drawer {...sheet.drawer}>
      <DrawerContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (choice) void sheet.run(() => handOver(choice))
          }}
          className="flex flex-col gap-4"
        >
          <DrawerHeader>
            <DrawerTitle>Verwalterrolle übergeben</DrawerTitle>
            <DrawerDescription>
              Wähle, wer die Gruppe ab jetzt verwaltet. Du bleibst Spieler der
              Gruppe.
            </DrawerDescription>
          </DrawerHeader>
          {accounts.length === 0 ? (
            <Alert>
              <Info />
              <AlertDescription>
                Noch ist außer dir niemand mit Konto in der Gruppe. Lade
                jemanden ein, dann kannst du die Rolle übergeben.
              </AlertDescription>
            </Alert>
          ) : (
            <RadioGroup
              aria-label="Spieler mit Konto"
              value={choice}
              onValueChange={(value) => setChoice(value as string)}
              className="gap-2"
            >
              {accounts.map((p) => (
                <RadioCard key={p.id} value={p.id}>
                  <RadioCardTitle>{p.name}</RadioCardTitle>
                  <RadioCardDescription>Spieler mit Konto</RadioCardDescription>
                </RadioCard>
              ))}
            </RadioGroup>
          )}
          <FieldError>{sheet.error}</FieldError>
          <DrawerFooter orientation="horizontal">
            <DrawerClose
              render={<Button variant="secondary" size="lg" />}
              disabled={sheet.pending}
            >
              Abbrechen
            </DrawerClose>
            <Button type="submit" size="lg" disabled={sheet.pending || !choice}>
              Übergeben
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

/** "Gruppe verlassen?": the signed-in account becomes a Former Player. */
function LeaveSheet({
  group,
  onClose,
}: {
  group: GroupView
  onClose: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const sheet = useSheet(onClose)

  async function leave() {
    const result = await leaveGroupFn({ data: { groupId: group.id } })
    if (!result.ok) {
      return result.code === "adminCannotLeave"
        ? "Du verwaltest die Gruppe inzwischen. Übergib die Rolle zuerst."
        : "Das hat nicht geklappt."
    }
    // Away from the Group first: its page would load it again otherwise.
    await navigate({ to: "/" })
    await leftGroup(queryClient, group.id)
  }

  return (
    <Drawer {...sheet.drawer}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Gruppe verlassen?</DrawerTitle>
          <DrawerDescription>
            In {group.name} stehst du danach als ehemaliger Spieler. Deine
            bisherigen Spiele bleiben. Zurück kommst du nur über eine neue
            Einladung.
          </DrawerDescription>
        </DrawerHeader>
        <FieldError>{sheet.error}</FieldError>
        <DrawerFooter>
          <Button
            variant="destructive"
            size="xl"
            disabled={sheet.pending}
            onClick={() => void sheet.run(leave)}
          >
            Verlassen
          </Button>
          <DrawerClose
            render={<Button variant="secondary" size="xl" />}
            disabled={sheet.pending}
          >
            Abbrechen
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

/** The second line of a row: "Gast, von Ben angelegt", "du, Verwalter" … */
function PlayerTag({ player }: { player: GroupPlayer }) {
  const tag = playerTag(player)
  return tag ? <ItemDescription>{tag}</ItemDescription> : null
}

/** "du, Verwalter", "seit heute dabei", "Gast, von Ben angelegt" … */
function playerTag(p: GroupPlayer): string {
  if (p.guest) return p.addedBy ? `Gast, von ${p.addedBy} angelegt` : "Gast"
  const tags = [
    p.me ? "du" : null,
    p.admin ? "Verwalter" : null,
    !p.me && isToday(p.joinedAt) ? "seit heute dabei" : null,
  ]
  return tags.filter(Boolean).join(", ")
}

/** "ausgetreten im September", "entfernt im Oktober 2025", "Konto gelöscht". */
function leftLabel(p: FormerPlayer): string {
  if (p.reason === "deleted") return "Konto gelöscht"
  const when = formatMonth(p.leftAt)
  return p.reason === "left" ? `ausgetreten im ${when}` : `entfernt im ${when}`
}
