import { Badge } from "@/components/ui/badge"
import { Item } from "@/components/ui/item"
import { cn } from "@/lib/utils"
import type { ComponentProps, ReactElement, ReactNode } from "react"

/**
 * A row of the Group Leaderboard (`i13-rangliste`): place, name, value with
 * its detail. Place 1 in the primary colour; `pending` rows (not ranked yet)
 * muted. With an account the row is a link (`render={<Link … />}`).
 *
 * ```tsx
 * <RankingRow first render={<Link to="/players/$userId" … />}>
 *   <RankingPlace>1</RankingPlace>
 *   <RankingName guest={false}>Ben</RankingName>
 *   <RankingValue detail="aus 71 Spielen">15</RankingValue>
 * </RankingRow>
 * ```
 */
export function RankingRow({
  first = false,
  pending = false,
  render,
  className,
  children,
}: {
  first?: boolean
  pending?: boolean
  render?: ReactElement
  className?: string
  children: ReactNode
}) {
  return (
    <li data-slot="ranking-row">
      <Item
        variant="row"
        size="list"
        render={render}
        data-first={first || undefined}
        data-pending={pending || undefined}
        className={cn(
          "group/ranking-row grid min-h-[55px] grid-cols-[40px_minmax(0,1fr)_auto] gap-x-2 py-2 data-pending:min-h-13 data-pending:text-muted-foreground",
          className
        )}
      >
        {children}
      </Item>
    </li>
  )
}

/** The place, 17 px / 600; place 1 in `primary`. Empty for pending rows. */
export function RankingPlace({ children }: { children?: ReactNode }) {
  return (
    <span className="text-center text-[17px] font-semibold text-muted-foreground tabular-nums group-data-first/ranking-row:text-primary">
      {children === undefined ? null : (
        <>
          <span className="sr-only">Platz </span>
          {children}
        </>
      )}
    </span>
  )
}

/** The name, 17 px (600 on place 1), with "Gast" after it for a Guest. */
export function RankingName({
  guest,
  children,
}: {
  guest: boolean
  children: ReactNode
}) {
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="truncate text-[17px] font-medium group-data-first/ranking-row:font-semibold">
        {children}
      </span>
      {guest ? <Badge variant="plain">Gast</Badge> : null}
    </span>
  )
}

/** The value, 18 px bold (`primary` on place 1), with its detail under it. */
export function RankingValue({
  detail,
  children,
}: {
  detail: ReactNode
  children: ReactNode
}) {
  return (
    <span className="flex flex-col items-end">
      <span className="text-lg leading-tight font-bold tabular-nums group-data-first/ranking-row:text-primary">
        {children}
      </span>
      <span className="text-sm text-muted-foreground tabular-nums">
        {detail}
      </span>
    </span>
  )
}

/** On a pending row: "4 von 5 Spielen". */
export function RankingNote(props: ComponentProps<"span">) {
  return <span className="text-[15px] tabular-nums" {...props} />
}
