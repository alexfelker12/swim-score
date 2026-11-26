import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { PenLine } from "lucide-react"
import {
  PageHeader,
  PageHeaderAction,
  PageHeaderActions,
  PageHeaderBackInHistory,
} from "@/components/page-header"
import { PersonalStats } from "@/components/personal-stats"
import {
  ProfileHeading,
  ProfileHeadingContent,
  ProfileHeadingDescription,
  ProfileHeadingSkeleton,
  ProfileHeadingTitle,
} from "@/components/profile-heading"
import { PersonAvatar } from "@/components/person-avatar"
import { Page } from "@/components/page"
import { PageNotFound } from "@/components/page-not-found"
import {
  PageLoading,
  PageLoadingContent,
  PageLoadingHeader,
} from "@/components/page-loading"
import { Skeleton } from "@/components/ui/skeleton"
import { loadPageData } from "@/lib/page-data"
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
  loader: ({ context, params, deps, cause }) =>
    loadPageData(cause, async () => {
      const profile = await context.queryClient.query(
        playerProfileQuery(params.userId, deps)
      )
      if (!profile) throw notFound()
    }),
  pendingComponent: PlayerProfileLoading,
  component: PlayerProfilePage,
})

function PlayerProfilePage() {
  const { userId } = Route.useParams()
  const period = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: profile } = useSuspenseQuery(playerProfileQuery(userId, period))
  if (!profile) return <PageNotFound />
  return (
    <Page>
      <PageHeader>
        <PageHeaderBackInHistory />
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
        <PersonAvatar
          size="xl"
          name={profile.name}
          image={profile.image}
          zoomable
        />
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

/** While the Player Profile loads: picture, name and stats as placeholders. */
function PlayerProfileLoading() {
  return (
    <PageLoading>
      <PageLoadingHeader />
      <PageLoadingContent className="pt-1">
        <ProfileHeadingSkeleton size="lg" className="px-1 pb-3" />
        <div className="flex items-center justify-between px-1 pb-1">
          <Skeleton variant="line" className="h-4.5 w-36" />
          <Skeleton className="h-11 w-34" />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} variant="card" className="h-20" />
          ))}
        </div>
      </PageLoadingContent>
    </PageLoading>
  )
}
