import { cva } from "class-variance-authority"
import { Trophy } from "lucide-react"
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
 * The places at the end: Platz, name, lives lost, Bombs. The winner's place
 * in the primary colour, the Swimmer's row tinted.
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
          <TableHead className="w-14 pl-3">Platz</TableHead>
          <TableHead>
            <span className="sr-only">Name</span>
          </TableHead>
          <TableHead className="w-18 text-right">Leben</TableHead>
          <TableHead className="w-22 pr-3 text-right">Bomben</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="[&_tr:last-child]:border-b">{children}</TableBody>
    </Table>
  )
}

const placeVariants = cva("pl-3 text-lg", {
  variants: {
    first: {
      true: "font-bold text-primary",
      false: "font-medium text-muted-foreground",
    },
  },
})

const nameVariants = cva("text-lg whitespace-normal", {
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
  /** Swam in this Game: the row is tinted. */
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
      <TableCell className={placeVariants({ first })}>{place}</TableCell>
      <TableCell className={nameVariants({ first })}>
        {name}
        {swimmer ? <span className="sr-only">, Schwimmer</span> : null}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {livesLost}
      </TableCell>
      <TableCell className="pr-3 text-right text-muted-foreground">
        {bombs}
      </TableCell>
    </TableRow>
  )
}
