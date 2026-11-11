import { useQuery } from "@tanstack/react-query"
import { groupManagementQuery } from "@/lib/queries"
import type { GroupManagement } from "@/server/invites"

/**
 * Open Claims and link candidates, for the Group Admin only; null for anyone
 * else, without asking the server. The loader has already loaded them for
 * the Group Admin, so this never waits.
 */
export function useManagement(
  groupId: string,
  isAdmin: boolean
): GroupManagement | null {
  const { data } = useQuery({
    ...groupManagementQuery(groupId),
    enabled: isAdmin,
  })
  return isAdmin ? (data ?? null) : null
}
