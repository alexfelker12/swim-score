import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Link,
  createFileRoute,
  notFound,
  useCanGoBack,
  useRouter,
} from "@tanstack/react-router"
import { PenLine } from "lucide-react"
import {
  PageHeader,
  PageHeaderAction,
  PageHeaderActions,
  PageHeaderBack,
} from "@/components/page-header"
import { PersonalStats } from "@/components/personal-stats"
import {
  ProfileHeading,
  ProfileHeadingContent,
  ProfileHeadingDescription,
  ProfileHeadingTitle,
} from "@/components/profile-heading"
import { PersonAvatar } from "@/components/person-avatar"
import { Page } from "@/components/page"
import { formatMonthYear } from "@/lib/dates"
import { periodFromSearch } from "@/lib/period-search"
import { playerProfileQuery } from "@/lib/queries"
import type { PlayerProfile } from "@/server/player-profile"
import type { Period } from "@/server/stats"

/** The Player Profile of an account: its Personal Stats, for anyone sharing a Group. */
export const Route = createFileRoute("/_authenticated/players/$userId")({
  validateSearch: (search: Record<string, unknown>): Period =>
    periodFromSearch(search),
  loaderDeps: ({ search }) => ({ from: search.from, to: search.to }),
  loader: async ({ context, params, deps }) => {
    const profile = await context.queryClient.query(
      playerProfileQuery(params.userId, deps)
    )
    if (!profile) throw notFound()
  },
  component: PlayerProfilePage,
})

function PlayerProfilePage() {
  const { userId } = Route.useParams()
  const period = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: profile } = useSuspenseQuery(playerProfileQuery(userId, period))
  if (!profile) return null
  return (
    <Page>
      <PageHeader>
        <BackButton />
        {profile.isMe ? (
          <PageHeaderActions>
            <PageHeaderAction
              render={<Link to="/profile" />}
              label="Profil bearbeiten"
            >
              <PenLine />
            </PageHeaderAction>
          </PageHeaderActions>
        ) : null}
      </PageHeader>
      <ProfileHeading size="lg" className="px-5 pt-1 pb-4">
        <PersonAvatar size="xl" name={profile.name} image={profile.image} />
        <ProfileHeadingContent>
          <ProfileHeadingTitle as="h1">{profile.name}</ProfileHeadingTitle>
          <ProfileHeadingDescription>
            {subline(profile)}
          </ProfileHeadingDescription>
        </ProfileHeadingContent>
      </ProfileHeading>
      <PersonalStats
        profile={profile}
        period={period}
        onPeriodChange={(next) => navigate({ search: next, replace: true })}
      />
    </Page>
  )
}

/** "Spielt in 2 Gruppen" on the own profile, "Spielt seit März 2024" on others. */
function subline(profile: PlayerProfile): string {
  if (profile.isMe && profile.groupCount !== null) {
    if (profile.groupCount === 0) return "Noch in keiner Gruppe"
    return profile.groupCount === 1
      ? "Spielt in 1 Gruppe"
      : `Spielt in ${profile.groupCount} Gruppen`
  }
  return profile.since
    ? `Spielt seit ${formatMonthYear(profile.since)}`
    : "Noch kein Spiel beendet"
}

/** Back to where the profile was opened from (Leaderboard, Player list), else home. */
function BackButton() {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return canGoBack ? (
    <PageHeaderBack label="Zurück" onClick={() => router.history.back()} />
  ) : (
    <PageHeaderBack render={<Link to="/" />} label="Zur Startseite" />
  )
}
