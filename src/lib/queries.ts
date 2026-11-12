import { queryOptions } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import {
  getGameFn,
  getGroupFn,
  getGroupManagementFn,
  getInviteFn,
  getInviteLinkFn,
  getNewGameFn,
  getProfileFn,
  getSpectatorGameFn,
  listGamesFn,
  listMyGroupsFn,
} from "@/server/functions"

/**
 * Every query key of the app, in one place. Whatever belongs to one Group
 * sits below `group(groupId)`, so a change to the Group can reload all of it
 * with that one prefix.
 */
export const queryKeys = {
  myGroups: () => ["myGroups"] as const,
  /** Prefix of everything about one Group. */
  group: (groupId: string) => ["group", groupId] as const,
  groupView: (groupId: string) => ["group", groupId, "view"] as const,
  groupGames: (groupId: string) => ["group", groupId, "games"] as const,
  groupManagement: (groupId: string) =>
    ["group", groupId, "management"] as const,
  newGame: (groupId: string) => ["group", groupId, "newGame"] as const,
  inviteLink: (groupId: string) => ["group", groupId, "inviteLink"] as const,
  invite: (token: string) => ["invite", token] as const,
  /** Prefix of every Game. */
  games: () => ["game"] as const,
  game: (gameId: string) => ["game", gameId] as const,
  profile: () => ["profile"] as const,
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

// Routes load these in their loader with `queryClient.query(...)`, which
// takes fresh data from the cache and loads stale or invalidated data again
// before the page renders, and read them with `useSuspenseQuery`.

/** "Meine Gruppen". */
export function myGroupsQuery() {
  return queryOptions({
    queryKey: queryKeys.myGroups(),
    queryFn: () => listMyGroupsFn(),
  })
}

/** The Group with its Players, or null when the viewer may not see it. */
export function groupQuery(groupId: string) {
  return queryOptions({
    queryKey: queryKeys.groupView(groupId),
    queryFn: () => getGroupFn({ data: { groupId } }),
  })
}

/** The Group's Games, newest first. */
export function groupGamesQuery(groupId: string) {
  return queryOptions({
    queryKey: queryKeys.groupGames(groupId),
    queryFn: () => listGamesFn({ data: { groupId } }),
  })
}

/** Open Claims and link candidates; null for anyone but the Group Admin. */
export function groupManagementQuery(groupId: string) {
  return queryOptions({
    queryKey: queryKeys.groupManagement(groupId),
    queryFn: () => getGroupManagementFn({ data: { groupId } }),
  })
}

/** "Neues Spiel": the current Players and the last Seating Order, or null. */
export function newGameQuery(groupId: string) {
  return queryOptions({
    queryKey: queryKeys.newGame(groupId),
    queryFn: () => getNewGameFn({ data: { groupId } }),
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
    queryFn: () => getGameFn({ data: { gameId } }),
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
 * Games. Reloads all of the Group and "Meine Gruppen". With `games`, also
 * every Game, because names shown in past Games changed (a Guest merged into
 * an account, the Group renamed).
 */
export async function groupChanged(
  queryClient: QueryClient,
  groupId: string,
  { games = false, ...when }: When & { games?: boolean } = {}
) {
  await Promise.all([
    invalidate(queryClient, queryKeys.group(groupId), when),
    invalidate(queryClient, queryKeys.myGroups(), when),
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
  await invalidate(queryClient, queryKeys.myGroups(), { later: true })
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
