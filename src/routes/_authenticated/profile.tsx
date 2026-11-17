import { useRef, useState } from "react"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { LogOut, Moon, Sun, SunMoon, Trash2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { AvatarEditor } from "@/components/avatar-editor"
import {
  PageHeader,
  PageHeaderBack,
  PageHeaderTitle,
} from "@/components/page-header"
import { PersonalStats } from "@/components/personal-stats"
import {
  ProfileHeading,
  ProfileHeadingContent,
  ProfileHeadingDescription,
  ProfileHeadingTitle,
} from "@/components/profile-heading"
import type { AvatarEditorStart } from "@/components/avatar-editor"
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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldNote,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioSegment } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authClient } from "@/lib/auth-client"
import { periodFromSearch } from "@/lib/period-search"
import {
  playerProfileQuery,
  profileChanged,
  profileQuery,
  queryKeys,
} from "@/lib/queries"
import {
  deleteAccountFn,
  setThemeFn,
  updateProfileFn,
} from "@/server/functions"
import type { Profile, Theme } from "@/server/profile"
import type { Period } from "@/server/stats"

type ProfileSearch = Period & { tab?: "stats" }

export const Route = createFileRoute("/_authenticated/profile")({
  validateSearch: (search: Record<string, unknown>): ProfileSearch => ({
    ...(search.tab === "stats" ? { tab: "stats" as const } : {}),
    ...periodFromSearch(search),
  }),
  loaderDeps: ({ search }) => ({
    stats: search.tab === "stats",
    from: search.from,
    to: search.to,
  }),
  loader: async ({ context, deps }) => {
    const profile = await context.queryClient.query(profileQuery())
    if (deps.stats) {
      await context.queryClient.query(
        playerProfileQuery(profile.id, { from: deps.from, to: deps.to })
      )
    }
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { data: profile } = useSuspenseQuery(profileQuery())
  const { tab = "details", from, to } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader>
        <PageHeaderBack
          render={<Link to="/" />}
          label="Zurück zur Startseite"
        />
        <PageHeaderTitle>Profil</PageHeaderTitle>
      </PageHeader>

      <ProfileHeading className="px-5 pt-1 pb-3.5">
        <PersonAvatar size="lg" name={profile.name} image={profile.image} />
        <ProfileHeadingContent>
          <ProfileHeadingTitle>{profile.name}</ProfileHeadingTitle>
          <ProfileHeadingDescription>
            @{profile.username}
          </ProfileHeadingDescription>
        </ProfileHeadingContent>
      </ProfileHeading>

      <Tabs
        value={tab}
        onValueChange={(next) =>
          navigate({
            search: (previous) => ({
              ...previous,
              tab: next === "stats" ? "stats" : undefined,
            }),
            replace: true,
          })
        }
        className="gap-3.5"
      >
        <TabsList aria-label="Profil" className="mx-4 w-auto">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="stats">Meine Statistik</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <Details profile={profile} />
        </TabsContent>
        <TabsContent value="stats">
          <MyStats userId={profile.id} period={{ from, to }} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Tab "Meine Statistik": the own Personal Stats, as on the Player Profile. */
function MyStats({ userId, period }: { userId: string; period: Period }) {
  const navigate = Route.useNavigate()
  const { data: stats } = useSuspenseQuery(playerProfileQuery(userId, period))
  if (!stats) return null
  return (
    <PersonalStats
      profile={stats}
      period={period}
      onPeriodChange={({ from, to }) =>
        navigate({
          search: (previous) => ({ ...previous, from, to }),
          replace: true,
        })
      }
    />
  )
}

const profileErrors: Partial<
  Record<string, { field: "name" | "email"; message: string }>
> = {
  invalidName: { field: "name", message: "Zwischen 1 und 30 Zeichen." },
  invalidEmail: {
    field: "email",
    message: "Das ist keine gültige E-Mail-Adresse.",
  },
  emailTaken: {
    field: "email",
    message: "Zu dieser E-Mail gibt es schon ein Konto.",
  },
}

const themes: Array<{ value: Theme; label: string; icon: LucideIcon }> = [
  { value: "system", label: "System", icon: SunMoon },
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
]

function Details({ profile }: { profile: Profile }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  /** The own name, e-mail or picture changed; the Viewer (header) via the router. */
  async function reloadAfterChange() {
    await profileChanged(queryClient)
    await router.invalidate()
  }
  const fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "email", string>>
  >({})
  const [editor, setEditor] = useState<AvatarEditorStart | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const changed = name !== profile.name || email !== profile.email

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setErrors({})
    const result = await updateProfileFn({ data: { name, email } })
    setPending(false)
    if (!result.ok) {
      const known = profileErrors[result.code]
      setErrors(
        known
          ? { [known.field]: known.message }
          : { name: "Das hat nicht geklappt." }
      )
      return
    }
    setSaved(true)
    await reloadAfterChange()
  }

  /** With a picture the editor opens on it; without one, the file picker comes first. */
  function changePicture() {
    if (profile.image) setEditor({ kind: "saved" })
    else fileInput.current?.click()
  }

  async function chooseTheme(theme: Theme) {
    await setThemeFn({ data: { theme } })
    await queryClient.invalidateQueries({ queryKey: queryKeys.profile() })
    // The theme comes with the Viewer.
    await router.invalidate()
  }

  async function signOut() {
    await authClient.signOut()
    queryClient.clear()
    await router.invalidate()
    await router.navigate({ to: "/sign-in" })
  }

  return (
    <div className="flex flex-col gap-4.5 px-5 pt-1 pb-6">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>Profilbild</FieldTitle>
          <FieldDescription>Sehen alle in deinen Gruppen</FieldDescription>
        </FieldContent>
        <Button variant="outline" size="sm" onClick={changePicture}>
          Bild ändern
        </Button>
        <Input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) setEditor({ kind: "file", file })
          }}
        />
      </Field>
      {editor ? (
        <AvatarEditor
          start={editor}
          hasSavedPicture={profile.image !== null}
          name={profile.name}
          onClose={() => setEditor(null)}
          onSaved={reloadAfterChange}
        />
      ) : null}

      <form onSubmit={save} className="flex flex-col gap-4.5" noValidate>
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="profile-name">Anzeigename</FieldLabel>
          <Input
            id="profile-name"
            value={name}
            maxLength={30}
            onChange={(e) => {
              setName(e.target.value)
              setSaved(false)
            }}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby="profile-name-note"
          />
          <FieldNote id="profile-name-note" error={errors.name}>
            So heißt du in Spielen und Ranglisten.
          </FieldNote>
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-username">Benutzername</FieldLabel>
          <Input
            id="profile-username"
            value={profile.username}
            readOnly
            aria-describedby="profile-username-note"
          />
          <FieldDescription id="profile-username-note">
            Damit meldest du dich an. Lässt sich nicht ändern.
          </FieldDescription>
        </Field>
        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="profile-email">E-Mail</FieldLabel>
          <Input
            id="profile-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setSaved(false)
            }}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby="profile-email-note"
          />
          <FieldNote id="profile-email-note" error={errors.email}>
            Nur für dich sichtbar.
          </FieldNote>
        </Field>
        <Button type="submit" size="lg" disabled={pending || !changed}>
          {saved && !changed ? "Gespeichert" : "Änderungen speichern"}
        </Button>
      </form>

      <Field>
        <FieldTitle id="profile-theme">Darstellung</FieldTitle>
        <RadioGroup
          variant="segmented"
          aria-labelledby="profile-theme"
          value={profile.theme}
          onValueChange={(theme) => void chooseTheme(theme as Theme)}
        >
          {themes.map((theme) => (
            <RadioSegment key={theme.value} value={theme.value}>
              <theme.icon />
              {theme.label}
            </RadioSegment>
          ))}
        </RadioGroup>
      </Field>

      <Separator />
      <Button variant="secondary" size="lg" onClick={signOut}>
        <LogOut />
        Abmelden
      </Button>
      <Separator />
      <div className="flex flex-col gap-2">
        <Button
          variant="destructive-outline"
          size="lg"
          onClick={() => setDeleting(true)}
        >
          <Trash2 />
          Konto löschen
        </Button>
        <FieldDescription>
          Löscht Name, Bild, E-Mail und Zugangsdaten. In deinen Gruppen stehst
          du danach als „Ehemaliger Spieler“ in den alten Spielen, die
          Ergebnisse der anderen bleiben gleich.
        </FieldDescription>
      </div>
      <DeleteAccountSheet open={deleting} onOpenChange={setDeleting} />
    </div>
  )
}

/** "Konto löschen?": the last step before the account is gone. */
function DeleteAccountSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setPending(true)
    setError(null)
    const result = await deleteAccountFn()
    if (!result.ok) {
      setError(
        result.code === "stillAdmin"
          ? "Du verwaltest noch eine Gruppe, in der andere ein Konto haben. Übergib dort zuerst die Verwalterrolle."
          : "Das hat nicht geklappt."
      )
      setPending(false)
      return
    }
    // The session is gone with the account; this clears its cookie.
    await authClient.signOut().catch(() => undefined)
    queryClient.clear()
    await router.invalidate()
    await router.navigate({ to: "/sign-in" })
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        onOpenChange(next)
        if (!next) setError(null)
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Konto löschen?</DrawerTitle>
          <DrawerDescription>
            Name, Bild, E-Mail und Zugangsdaten werden gelöscht. In deinen
            Gruppen stehst du danach als „Ehemaliger Spieler“ in den alten
            Spielen. Gruppen, in denen nie jemand anderes ein Konto hatte,
            werden mit ihren Spielen gelöscht. Das lässt sich nicht rückgängig
            machen.
          </DrawerDescription>
        </DrawerHeader>
        <FieldError>{error}</FieldError>
        <DrawerFooter>
          <Button
            variant="destructive"
            size="xl"
            disabled={pending}
            onClick={() => void remove()}
          >
            Konto löschen
          </Button>
          <DrawerClose
            render={<Button variant="secondary" size="xl" />}
            disabled={pending}
          >
            Abbrechen
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
