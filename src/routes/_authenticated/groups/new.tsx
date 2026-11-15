import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { PageFooter } from "@/components/page-footer"
import {
  PageHeader,
  PageHeaderBack,
  PageHeaderTitle,
} from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel, FieldNote } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { groupChanged } from "@/lib/queries"
import { createGroupFn } from "@/server/functions"

export const Route = createFileRoute("/_authenticated/groups/new")({
  component: NewGroupPage,
})

const groupErrors: Partial<Record<string, string>> = {
  invalidName: "Zwischen 1 und 40 Zeichen.",
}

function NewGroupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
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
    await groupChanged(queryClient, result.value.id, { later: true })
    await navigate({
      to: "/groups/$groupId",
      params: { groupId: result.value.id },
      search: { tab: "players" },
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-svh flex-col">
      <PageHeader>
        <PageHeaderBack
          icon="close"
          render={<Link to="/" />}
          label="Schließen"
        />
        <PageHeaderTitle>Neue Gruppe</PageHeaderTitle>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-6 px-5 pt-6">
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="group-name">Name der Gruppe</FieldLabel>
          <Input
            id="group-name"
            value={name}
            maxLength={40}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby="group-name-note"
          />
          <FieldNote id="group-name-note" error={error}>
            Zum Beispiel wo oder wann ihr spielt.
          </FieldNote>
        </Field>

        <Card
          variant="muted"
          render={<section aria-labelledby="next-steps" />}
          className="gap-2"
        >
          <CardTitle>
            <h2 id="next-steps">So geht es weiter</h2>
          </CardTitle>
          <CardDescription>
            <ol>
              <li>Du bist Verwalter der Gruppe.</li>
              <li>Leute ohne Konto legst du als Gäste an.</li>
              <li>Alle anderen holst du per Link oder QR-Code dazu.</li>
            </ol>
          </CardDescription>
        </Card>
      </div>

      <PageFooter>
        <Button
          type="submit"
          size="xl"
          disabled={pending || name.trim() === ""}
        >
          Gruppe anlegen
        </Button>
      </PageFooter>
    </form>
  )
}
