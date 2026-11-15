import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Link,
  createFileRoute,
  notFound,
  useCanGoBack,
  useRouter,
} from "@tanstack/react-router"
import { ChevronLeft, PenLine } from "lucide-react"
import { PersonalStats } from "@/components/personal-stats"
import { UserAvatar } from "@/components/user-avatar"
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
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between px-1">
        <BackButton />
        {profile.isMe ? (
          <Link
            to="/profile"
            aria-label="Profil bearbeiten"
            className="flex size-11 items-center justify-center rounded-xl"
          >
            <PenLine className="size-6" aria-hidden="true" />
          </Link>
        ) : null}
      </header>
      <div className="flex items-center gap-4 px-5 pt-1 pb-4">
        <UserAvatar name={profile.name} image={profile.image} size={64} />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-[28px] leading-tight font-bold">
            {profile.name}
          </h1>
          <span className="text-base text-muted-foreground">
            {subline(profile)}
          </span>
        </div>
      </div>
      <PersonalStats
        profile={profile}
        period={period}
        onPeriodChange={(next) => navigate({ search: next, replace: true })}
      />
    </div>
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
  const className = "flex size-11 items-center justify-center rounded-xl"
  const icon = <ChevronLeft className="size-6" aria-hidden="true" />
  return canGoBack ? (
    <button
      type="button"
      aria-label="Zurück"
      onClick={() => router.history.back()}
      className={className}
    >
      {icon}
    </button>
  ) : (
    <Link to="/" aria-label="Zur Startseite" className={className}>
      {icon}
    </Link>
  )
}
