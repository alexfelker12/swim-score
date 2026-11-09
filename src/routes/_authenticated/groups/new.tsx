import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { X } from "lucide-react"
import { PrimaryButton } from "@/components/buttons"
import { Field, TextInput } from "@/components/form-field"
import { createGroupFn } from "@/server/functions"

export const Route = createFileRoute("/_authenticated/groups/new")({
  component: NewGroupPage,
})

const groupErrors: Partial<Record<string, string>> = {
  invalidName: "Zwischen 1 und 40 Zeichen.",
}

function NewGroupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await createGroupFn({ data: { name } })
    if (!result.ok) {
      setPending(false)
      setError(groupErrors[result.code] ?? "Das hat nicht geklappt.")
      return
    }
    await navigate({
      to: "/groups/$groupId",
      params: { groupId: result.value.id },
      search: { tab: "players" },
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-svh flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[52px_minmax(0,1fr)_52px] items-center px-1">
        <Link
          to="/"
          aria-label="Schließen"
          className="flex size-11 items-center justify-center justify-self-center rounded-xl"
        >
          <X className="size-6" aria-hidden="true" />
        </Link>
        <h1 className="text-center text-[17px] font-semibold">Neue Gruppe</h1>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-5 pt-6">
        <Field
          label="Name der Gruppe"
          hint="Zum Beispiel wo oder wann ihr spielt."
          error={error}
        >
          {(field) => (
            <TextInput
              {...field}
              value={name}
              maxLength={40}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

        <section
          aria-labelledby="next-steps"
          className="flex flex-col gap-2 rounded-[14px] bg-muted p-4"
        >
          <h2 id="next-steps" className="text-base font-semibold">
            So geht es weiter
          </h2>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground marker:text-muted-foreground">
            <li>Du bist Verwalter der Gruppe.</li>
            <li>Leute ohne Konto legst du als Gäste an.</li>
            <li>Alle anderen holst du per Link oder QR-Code dazu.</li>
          </ol>
        </section>
      </div>

      <div className="px-4 pt-4 pb-6">
        <PrimaryButton
          type="submit"
          disabled={pending || name.trim() === ""}
          className="w-full"
        >
          Gruppe anlegen
        </PrimaryButton>
      </div>
    </form>
  )
}
