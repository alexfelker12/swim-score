import { gameFilterOf } from "@/lib/game-filter"
import { orKept } from "@/lib/kept-on-device"
import { pagedQueryOptions } from "@/lib/paged-query"
import { queryOptions } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import type { GameStatus } from "@/server/db/schema"
import type { GameFilter } from "@/server/games"
import {
  getGameFn,
  getGroupFn,
  getGroupManagementFn,
  getHomeFn,
  getInviteFn,
  getInviteLinkFn,
  getLeaderboardFn,
  getNewGameFn,
  getPlayerProfileFn,
  getProfileFn,
  getSpectatorGameFn,
  listGamesFn,
  listGroupPlayersFn,
  listHomeGroupsFn,
} from "@/server/functions"

/**
 * Every query key of the app, in one place. Whatever belongs to one Group
 * sits below `group(groupId)`, so a change to the Group can reload all of it
 * with that one prefix.
 */
export const queryKeys = {
  /** The start page: running Games, "Neues Spiel"; prefix of "Meine Gruppen". */
  home: () => ["home"] as const,
  homeGroups: () => ["home", "groups"] as const,
  /** Prefix of everything about one Group. */
  group: (groupId: string) => ["group", groupId] as const,
  groupView: (groupId: string) => ["group", groupId, "view"] as const,
  /** Prefix of the Group's Games, filtered or not. */
  groupGames: (groupId: string) => ["group", groupId, "games"] as const,
  groupPlayers: (groupId: string) => ["group", groupId, "players"] as const,
  /** Every metric at once, for one period; `""` for an open end. */
  groupLeaderboard: (groupId: string, from = "", to = "") =>
    ["group", groupId, "leaderboard", from, to] as const,
  groupManagement: (groupId: string) =>
    ["group", groupId, "management"] as const,
  /** `fromGame`: "Nochmal mit denselben Teilnehmern"; `""` for the last Game. */
  newGame: (groupId: string, fromGame = "") =>
    ["group", groupId, "newGame", fromGame] as const,
  inviteLink: (groupId: string) => ["group", groupId, "inviteLink"] as const,
  invite: (token: string) => ["invite", token] as const,
  /** Prefix of every Game. */
  games: () => ["game"] as const,
  game: (gameId: string) => ["game", gameId] as const,
  profile: () => ["profile"] as const,
  /** Prefix of every Player Profile. */
  playerProfiles: () => ["playerProfile"] as const,
  /** One account's Player Profile for one period; `""` for an open end. */
  playerProfile: (userId: string, from = "", to = "") =>
    ["playerProfile", userId, from, to] as const,
  spectatorGame: (token: string) => ["spectatorGame", token] as const,
}

/** Mutation keys, so pending mutations can be found again. */
export const mutationKeys = {
  /**
   * Cancelling a Game. The Scorekeeper's other steps wait in the Game's
   * queue on the device instead (ADR 0007).
   */
  cancelGame: (gameId: string) => ["cancelGame", gameId] as const,
}

// Routes load these in their loader with `queryClient.query(...)` (lists:
// `fetchInfiniteQuery`), which takes fresh data from the cache and loads
// stale or invalidated data again, and read them with `useSuspenseQuery`
// (lists: `usePagedQuery`).

/**
 * The start page: running Games the viewer plays in and the Group for
 * "Neues Spiel"; "Meine Gruppen" in `homeGroupsQuery`.
 */
export function homeQuery() {
  return queryOptions({
    queryKey: queryKeys.home(),
    queryFn: ({ client, queryKey }) =>
      orKept(
        () => getHomeFn(),
        () => client.getQueryData(queryKey)
      ),
    // Without a connection the start page kept on the device stands in
    // (ADR 0012).
    meta: { keptOnDevice: {} },
  })
}

/**
 * "Meine Gruppen" on the start page, 15 at a time (#59). Without a
 * connection the Groups kept on the device stand in, as for the start page.
 */
export function homeGroupsQuery() {
  return pagedQueryOptions({
    queryKey: queryKeys.homeGroups(),
    queryFn: (page) => listHomeGroupsFn({ data: { page } }),
    keptOnDevice: {},
  })
}

/** The Group with its Players, or null when the viewer may not see it. */
export function groupQuery(groupId: string) {
  return queryOptions({
    queryKey: queryKeys.groupView(groupId),
    queryFn: () => getGroupFn({ data: { groupId } }),
  })
}

/**
 * The Group's Games, running ones and then the newest first, 15 at a time
 * (#59), as `filter` keeps them (#60).
 */
export function groupGamesQuery(groupId: string, filter: GameFilter = {}) {
  // Only what is set, in one order: the same filter is the same query.
  const set = gameFilterOf(filter)
  return pagedQueryOptions({
    queryKey: [...queryKeys.groupGames(groupId), set],
    queryFn: (page) => listGamesFn({ data: { groupId, filter: set, page } }),
  })
}

/** The Group's current Players by name, 25 at a time (#59). */
export function groupPlayersQuery(groupId: string) {
  return pagedQueryOptions({
    queryKey: queryKeys.groupPlayers(groupId),
    queryFn: (page) => listGroupPlayersFn({ data: { groupId, page } }),
    pageSize: 25,
  })
}

/**
 * The Group Leaderboard over the Group's completed Games, all of them or those
 * started between `from` and `to` (`YYYY-MM-DD`); null when the viewer may
 * not see it. Below the Group's key, so a finished Game reloads it.
 */
export function groupLeaderboardQuery(
  groupId: string,
  period: { from?: string; to?: string } = {}
) {
  return queryOptions({
    queryKey: queryKeys.groupLeaderboard(groupId, period.from, period.to),
    queryFn: () =>
      getLeaderboardFn({
        data: { groupId, from: period.from, to: period.to },
      }),
  })
}

/** Open Claims and link candidates; null for anyone but the Group Admin. */
export function groupManagementQuery(groupId: string) {
  return queryOptions({
    queryKey: queryKeys.groupManagement(groupId),
    queryFn: () => getGroupManagementFn({ data: { groupId } }),
  })
}

/**
 * "Neues Spiel": the current Players and a Seating Order to start from, that
 * of `fromGame` or of the last Game; null when the viewer may not start one.
 */
export function newGameQuery(groupId: string, fromGame?: string) {
  return queryOptions({
    queryKey: queryKeys.newGame(groupId, fromGame),
    queryFn: () => getNewGameFn({ data: { groupId, fromGame } }),
  })
}

/** The Group's Invite token; null for anyone but the Group Admin. */
export function inviteLinkQuery(groupId: string) {
  return queryOptions({
    queryKey: queryKeys.inviteLink(groupId),
    queryFn: () => getInviteLinkFn({ data: { groupId } }),
  })
}

/** The Group behind an Invite, or null when the Invite is not valid. */
export function inviteQuery(token: string) {
  return queryOptions({
    queryKey: queryKeys.invite(token),
    queryFn: () => getInviteFn({ data: { token } }),
  })
}

/** The Game as the server has it, or null when the viewer may not see it. */
export function gameQuery(gameId: string) {
  return queryOptions({
    queryKey: queryKeys.game(gameId),
    queryFn: ({ client, queryKey }) =>
      orKept(
        () => getGameFn({ data: { gameId } }),
        () => client.getQueryData(queryKey)
      ),
    // Without a connection the Game kept on the device stands in; a running
    // one is never dropped to make room (ADR 0012).
    meta: {
      keptOnDevice: { pinnedWhen: { status: "running" satisfies GameStatus } },
    },
  })
}

/**
 * An account's Player Profile with its Personal Stats, over all its Games or
 * those started between `from` and `to` (`YYYY-MM-DD`); null when the viewer
 * may not see it.
 */
export function playerProfileQuery(
  userId: string,
  period: { from?: string; to?: string } = {}
) {
  return queryOptions({
    queryKey: queryKeys.playerProfile(userId, period.from, period.to),
    queryFn: () =>
      getPlayerProfileFn({
        data: { userId, from: period.from, to: period.to },
      }),
  })
}

/** The signed-in account's own profile. */
export function profileQuery() {
  return queryOptions({
    queryKey: queryKeys.profile(),
    queryFn: () => getProfileFn(),
  })
}

// What to load again after a change. Each change says what it affected; the
// keys below decide which queries that means.

type When = {
  /**
   * Only mark as stale, for a change followed by navigating elsewhere: the
   * next page's loader loads what it needs, and nobody waits for the rest.
   */
  later?: boolean
}

function invalidate(
  queryClient: QueryClient,
  queryKey: ReadonlyArray<string>,
  { later = false }: When
) {
  return queryClient.invalidateQueries({
    queryKey,
    refetchType: later ? "none" : "active",
  })
}

/**
 * Something about a Group changed: its Players (a Guest added, a Player
 * removed, joined or merged, the Group Admin handed over), its name, its
 * Games. Reloads all of the Group, the start page and the Player Profiles,
 * whose Personal Stats and Group cards may show it. With `games`, also every
 * Game, because names shown in past Games changed (a Guest merged into an
 * account, the Group renamed).
 */
export async function groupChanged(
  queryClient: QueryClient,
  groupId: string,
  { games = false, ...when }: When & { games?: boolean } = {}
) {
  await Promise.all([
    invalidate(queryClient, queryKeys.group(groupId), when),
    invalidate(queryClient, queryKeys.home(), when),
    invalidate(queryClient, queryKeys.playerProfiles(), when),
    games ? invalidate(queryClient, queryKeys.games(), when) : null,
  ])
}

/**
 * Another device changed the Game (ADR 0005): load it again, and mark what
 * the Group shows of its Games (Round, Winner, running or not) as stale.
 */
export async function gameChanged(
  queryClient: QueryClient,
  gameId: string,
  groupId: string
) {
  await Promise.all([
    invalidate(queryClient, queryKeys.game(gameId), {}),
    groupChanged(queryClient, groupId, { later: true }),
  ])
}

/** The Game behind a Spectator link changed: load it again. */
export async function spectatorGameChanged(
  queryClient: QueryClient,
  token: string
) {
  await invalidate(queryClient, queryKeys.spectatorGame(token), {})
}

/** The signed-in account joined a Group via this Invite. */
export async function joined(
  queryClient: QueryClient,
  token: string,
  groupId: string,
  when: When = {}
) {
  await Promise.all([
    groupChanged(queryClient, groupId, when),
    invalidate(queryClient, queryKeys.invite(token), when),
  ])
}

/** The signed-in account is no longer in the Group: drop what was loaded of it. */
export async function leftGroup(queryClient: QueryClient, groupId: string) {
  queryClient.removeQueries({ queryKey: queryKeys.group(groupId) })
  await Promise.all([
    invalidate(queryClient, queryKeys.home(), { later: true }),
    // Who shares a Group with the account, and its Personal Stats, changed.
    invalidate(queryClient, queryKeys.playerProfiles(), { later: true }),
  ])
}

/**
 * The own name, e-mail or picture changed: the profile loads again now, and
 * everything else, which may show the name or picture, when shown next.
 */
export async function profileChanged(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ refetchType: "none" })
  await invalidate(queryClient, queryKeys.profile(), {})
}

/** The running Game behind a Spectator link (see `getSpectatorGameFn`). */
export function spectatorGameQuery(token: string) {
  return queryOptions({
    queryKey: queryKeys.spectatorGame(token),
    queryFn: () => getSpectatorGameFn({ data: { token } }),
  })
}
