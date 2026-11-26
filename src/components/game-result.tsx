import { cva } from "class-variance-authority"
import { Trophy, Waves } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { ComponentProps, ReactNode } from "react"

/**
 * The end of a Game (`i05-spielende`): trophy beside "Anna gewinnt",
 * centred, the Game's length under it.
 */
export function WinnerHeading({
  winner,
  children,
}: {
  winner: string
  /** The Game's length ("10 Runden, 6 Teilnehmer"). */
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 pt-6 pb-7 text-center">
      <div className="flex items-center justify-center gap-3">
        <Trophy
          className="size-9 shrink-0 text-primary"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <h2 className="text-[34px] leading-tight font-bold tracking-tight">
          {winner} gewinnt
        </h2>
      </div>
      <p className="text-[15px] text-muted-foreground">{children}</p>
    </div>
  )
}

/**
 * The places at the end: Platz, name, lives lost, Bombs (#63). Place, name
 * and values stand evenly apart; a long name wraps, the values never do.
 * The winner's place in the primary colour; the Swimmer's row tinted, with
 * the Swimmer icon left of the name.
 *
 * ```tsx
 * <ResultTable>
 *   <ResultRow place={1} name="Anna" swimmer={false} livesLost="−2" bombs={1} />
 * </ResultTable>
 * ```
 */
export function ResultTable({ children }: { children: ReactNode }) {
  return (
    <Table className="tabular-nums">
      <TableHeader>
        <TableRow>
          <TableHead className={cellVariants({ column: "place" })}>
            Platz
          </TableHead>
          <TableHead className={cellVariants({ column: "name" })}>
            <span className="sr-only">Name</span>
          </TableHead>
          <TableHead className={cellVariants({ column: "lives" })}>
            Leben
          </TableHead>
          <TableHead className={cellVariants({ column: "bombs" })}>
            Bomben
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="[&_tr:last-child]:border-b">{children}</TableBody>
    </Table>
  )
}

/**
 * One column, the same in the header and in every row: 10 px on both sides
 * of every cell, 12 px at the table's edges. Place and values only as wide
 * as their widest entry; the name takes the rest.
 */
const cellVariants = cva("px-2.5 first:pl-3 last:pr-3", {
  variants: {
    column: {
      place: "w-px text-center",
      name: "py-3 whitespace-normal",
      lives: "w-px text-right text-muted-foreground",
      bombs: "w-px text-right text-muted-foreground",
    },
  },
})

const placeVariants = cva("text-lg", {
  variants: {
    first: {
      true: "font-bold text-primary",
      false: "font-medium text-muted-foreground",
    },
  },
})

const nameVariants = cva("text-lg leading-snug break-words hyphens-auto", {
  variants: {
    first: { true: "font-bold", false: "font-medium" },
  },
})

export function ResultRow({
  place,
  name,
  swimmer,
  livesLost,
  bombs,
  className,
  ...props
}: ComponentProps<typeof TableRow> & {
  place: number
  name: string
  /** Swam in this Game: the row is tinted, the Swimmer icon before the name. */
  swimmer: boolean
  /** "−3", or "0". */
  livesLost: string
  bombs: number
}) {
  const first = place === 1
  return (
    <TableRow
      data-swimmer={swimmer || undefined}
      className={cn("data-swimmer:bg-swimmer/12", className)}
      {...props}
    >
      <TableCell
        className={cn(
          cellVariants({ column: "place" }),
          placeVariants({ first })
        )}
      >
        {place}
      </TableCell>
      <TableCell className={cellVariants({ column: "name" })}>
        <span className="flex items-center gap-2">
          {swimmer ? (
            <Waves
              className="size-5 shrink-0 text-swimmer"
              aria-hidden="true"
            />
          ) : null}
          <span className={nameVariants({ first })}>
            {name}
            {swimmer ? <span className="sr-only">, Schwimmer</span> : null}
          </span>
        </span>
      </TableCell>
      <TableCell className={cellVariants({ column: "lives" })}>
        {livesLost}
      </TableCell>
      <TableCell className={cellVariants({ column: "bombs" })}>
        {bombs}
      </TableCell>
    </TableRow>
  )
}
