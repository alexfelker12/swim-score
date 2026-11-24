import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { Plus, QrCode } from "lucide-react"
import {
  GroupRow,
  HomeSkeleton,
  NewGameButton,
  RunningGameCard,
} from "@/components/home"
import { InstallHint } from "@/components/install-hint"
import { ListEnd } from "@/components/list-end"
import { PageFooter } from "@/components/page-footer"
import { PageHeader } from "@/components/page-header"
import { Logo } from "@/components/logo"
import { Section, SectionDescription, SectionTitle } from "@/components/section"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PersonAvatar } from "@/components/person-avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Page } from "@/components/page"
import { formatWhen } from "@/lib/dates"
import { usePagedQuery } from "@/lib/paged-query"
import { homeGroupsQuery, homeQuery } from "@/lib/queries"
import { loadPageData } from "@/lib/page-data"
import type { Home } from "@/server/home"

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ context, cause }) =>
    loadPageData(cause, () =>
      Promise.all([
        context.queryClient.query(homeQuery()),
        context.queryClient.fetchInfiniteQuery(homeGroupsQuery()),
      ])
    ),
  pendingComponent: StartLoading,
  component: Start,
})

/**
 * Start page: into a Game in two taps. A running Game to continue or watch,
 * "Neues Spiel" in the Group last played in, then "Meine Gruppen".
 */
function Start() {
  const { data: home } = useSuspenseQuery(homeQuery())
  return (
    <Page>
      <StartHeader />
      {/* "Neues Spiel" needs a Group: none without. */}
      {home.newGame === null ? <Empty /> : <Overview home={home} />}
      <InstallHint />
    </Page>
  )
}

function StartHeader() {
  const { viewer } = Route.useRouteContext()
  return (
    <PageHeader variant="brand">
      <Logo />
      <PersonAvatar
        size="md"
        name={viewer.name}
        image={viewer.image}
        render={<Link to="/profile" aria-label="Profil öffnen" />}
      />
    </PageHeader>
  )
}

function Overview({ home }: { home: Home }) {
  const { runningGames, newGame } = home
  return (
    <main className="flex flex-col gap-3 px-4 pt-2 pb-6">
      {runningGames.length === 1 ? (
        <RunningGameCard game={runningGames[0]} />
      ) : runningGames.length > 1 ? (
        <Section aria-labelledby="running-games" className="gap-3">
          <SectionTitle id="running-games" className="mx-1">
            Laufende Spiele
          </SectionTitle>
          {runningGames.map((game) => (
            <RunningGameCard key={game.id} game={game} compact />
          ))}
        </Section>
      ) : null}

      {newGame ? (
        runningGames.length > 0 ? (
          <NewGameButton {...newGame} primary={false} />
        ) : (
          <div className="flex flex-col gap-2.5">
            <NewGameButton {...newGame} primary />
            {newGame.lastPlayedAt ? (
              <SectionDescription className="text-center">
                Dort habt ihr zuletzt gespielt,{" "}
                {formatWhen(newGame.lastPlayedAt)}
              </SectionDescription>
            ) : null}
          </div>
        )
      ) : null}

      <Section aria-labelledby="my-groups" className="mt-4 gap-2">
        <SectionTitle id="my-groups" className="mx-1 mb-1">
          Meine Gruppen
        </SectionTitle>
        <MyGroups />
        <Button
          variant="add"
          size="xl"
          className="justify-start"
          nativeButton={false}
          render={<Link to="/groups/new" />}
        >
          <Plus />
          Gruppe anlegen
        </Button>
      </Section>
    </main>
  )
}

/** "Meine Gruppen", more loading at the end of the list (#59). */
function MyGroups() {
  const groups = usePagedQuery(homeGroupsQuery())
  return (
    <>
      {groups.items.map((group) => (
        <GroupRow key={group.id} group={group} />
      ))}
      <ListEnd
        list={groups}
        placeholder={<Skeleton variant="card" className="h-17" />}
      />
    </>
  )
}

function Empty() {
  const { viewer } = Route.useRouteContext()
  return (
    <>
      <main className="flex flex-1 flex-col justify-center gap-4 px-6 pb-10">
        <SectionTitle as="h1" variant="page">
          Hallo {viewer.name}
        </SectionTitle>
        <SectionDescription size="lg">
          Du bist noch in keiner Gruppe. Leg eine an und lade deine Runde ein,
          oder lass dir von jemandem den Einladungslink geben.
        </SectionDescription>
        <Alert variant="note" className="mt-2">
          <QrCode />
          <AlertDescription>
            Am Tisch geht es am schnellsten: Der Verwalter zeigt den QR-Code, du
            scannst ihn mit der Kamera.
          </AlertDescription>
        </Alert>
      </main>
      <PageFooter className="pt-0">
        <Button
          size="xl"
          nativeButton={false}
          render={<Link to="/groups/new" />}
        >
          Gruppe anlegen
        </Button>
      </PageFooter>
    </>
  )
}

/** While the start page loads: its cards as quiet placeholders. */
function StartLoading() {
  return (
    <Page>
      <StartHeader />
      <HomeSkeleton />
    </Page>
  )
}
