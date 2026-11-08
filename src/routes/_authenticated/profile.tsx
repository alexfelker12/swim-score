import { useRef, useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { ChevronLeft } from "lucide-react"
import { PrimaryButton, SecondaryButton } from "@/components/buttons"
import { Field, ReadOnlyValue, TextInput } from "@/components/form-field"
import { SegmentedTabs } from "@/components/segmented-tabs"
import { UserAvatar } from "@/components/user-avatar"
import { authClient } from "@/lib/auth-client"
import { resizeForAvatar } from "@/lib/resize-image"
import { cn } from "@/lib/utils"
import {
  getProfileFn,
  setAvatarFn,
  setThemeFn,
  updateProfileFn,
} from "@/server/functions"
import type { Profile, Theme } from "@/server/profile"

export const Route = createFileRoute("/_authenticated/profile")({
  loader: () => getProfileFn(),
  component: ProfilePage,
})

function ProfilePage() {
  const profile = Route.useLoaderData()
  const [tab, setTab] = useState<"details" | "stats">("details")
  return (
    <div className="flex min-h-svh flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[52px_minmax(0,1fr)_52px] items-center px-1">
        <Link
          to="/"
          aria-label="Zurück zur Startseite"
          className="flex size-11 items-center justify-center justify-self-center rounded-xl"
        >
          <ChevronLeft className="size-6" aria-hidden="true" />
        </Link>
        <h1 className="text-center text-[17px] font-semibold">Profil</h1>
      </header>

      <div className="flex items-center gap-3.5 px-5 pt-1 pb-3.5">
        <UserAvatar name={profile.name} image={profile.image} size={56} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[22px] leading-tight font-bold">
            {profile.name}
          </span>
          <span className="text-sm text-muted-foreground">
            @{profile.username}
          </span>
        </div>
      </div>

      <SegmentedTabs
        label="Profil"
        value={tab}
        onChange={setTab}
        options={[
          { value: "details", label: "Details" },
          { value: "stats", label: "Meine Statistik" },
        ]}
        className="mx-4 mb-3.5"
      />

      {tab === "details" ? (
        <Details profile={profile} />
      ) : (
        <div role="tabpanel" className="px-5 py-6 text-muted-foreground">
          Deine Statistik erscheint hier, sobald du Spiele gespielt hast.
        </div>
      )}
    </div>
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

function Details({ profile }: { profile: Profile }) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "email" | "image", string>>
  >({})
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)
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
    await router.invalidate()
  }

  async function changeImage(file: File) {
    setErrors({})
    try {
      const form = new FormData()
      form.set("image", await resizeForAvatar(file), "avatar")
      const result = await setAvatarFn({ data: form })
      if (!result.ok) throw new Error(result.code)
      await router.invalidate()
    } catch {
      setErrors({ image: "Dieses Bild ließ sich nicht verwenden." })
    }
  }

  async function chooseTheme(theme: Theme) {
    await setThemeFn({ data: { theme } })
    await router.invalidate()
  }

  async function signOut() {
    await authClient.signOut()
    await router.invalidate()
    await router.navigate({ to: "/sign-in" })
  }

  return (
    <div role="tabpanel" className="flex flex-col gap-4.5 px-5 pt-1 pb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium">Profilbild</span>
          <span
            className={cn(
              "text-[13px]",
              errors.image ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {errors.image ?? "Sehen alle in deinen Gruppen"}
          </span>
        </div>
        <SecondaryButton
          type="button"
          onClick={() => fileInput.current?.click()}
        >
          Bild ändern
        </SecondaryButton>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) void changeImage(file)
          }}
        />
      </div>

      <form onSubmit={save} className="flex flex-col gap-4.5" noValidate>
        <Field
          label="Anzeigename"
          hint="So heißt du in Spielen und Ranglisten."
          error={errors.name}
        >
          {(field) => (
            <TextInput
              {...field}
              value={name}
              maxLength={30}
              onChange={(e) => {
                setName(e.target.value)
                setSaved(false)
              }}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Benutzername</span>
          <ReadOnlyValue>{profile.username}</ReadOnlyValue>
          <span className="text-[13px] text-muted-foreground">
            Damit meldest du dich an. Lässt sich nicht ändern.
          </span>
        </div>
        <Field
          label="E-Mail"
          hint="Nur für dich sichtbar."
          error={errors.email}
        >
          {(field) => (
            <TextInput
              {...field}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setSaved(false)
              }}
            />
          )}
        </Field>
        <PrimaryButton
          type="submit"
          disabled={pending || !changed}
          className="h-13"
        >
          {saved && !changed ? "Gespeichert" : "Änderungen speichern"}
        </PrimaryButton>
      </form>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Darstellung</span>
        <SegmentedTabs
          label="Darstellung"
          value={profile.theme}
          onChange={chooseTheme}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Hell" },
            { value: "dark", label: "Dunkel" },
          ]}
        />
      </div>

      <div className="mt-1.5 flex flex-col border-t border-border">
        <button
          type="button"
          onClick={signOut}
          className="flex h-14 items-center border-b border-border text-left"
        >
          Abmelden
        </button>
        <div className="flex flex-col gap-2 pt-4">
          <button
            type="button"
            disabled
            className="h-11 self-start font-semibold text-destructive disabled:opacity-40"
          >
            Konto löschen
          </button>
          <span className="text-[13px] text-pretty text-muted-foreground">
            Löscht Name, Bild, E-Mail und Zugangsdaten. In deinen Gruppen stehst
            du danach als „Ehemaliger Spieler“ in den alten Spielen, die
            Ergebnisse der anderen bleiben gleich.
          </span>
        </div>
      </div>
    </div>
  )
}
