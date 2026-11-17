import { Bomb, Trophy } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cva } from "class-variance-authority"
import type { ReactNode } from "react"

/**
 * "Anna gewinnt" / "Abgebrochen" / "Läuft, Runde 5" with the Game's length,
 * at the top of the history (`i06-verlauf`); a trophy for a finished Game.
 */
export function GameOutcome({
  title,
  trophy = false,
  children,
}: {
  title: string
  trophy?: boolean
  /** The Game's length. */
  children: ReactNode
}) {
  return (
    <Card size="sm" className="flex-row items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-xl font-semibold">{title}</span>
        <span className="text-[15px] text-muted-foreground">{children}</span>
      </div>
      {trophy ? (
        <Trophy
          className="size-7 shrink-0 text-primary"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      ) : null}
    </Card>
  )
}

const historyTextVariants = cva(
  "flex items-start gap-2 text-[15px] font-medium text-pretty",
  {
    variants: {
      kind: {
        default: "",
        /** The Game's end. */
        end: "font-semibold",
        /** An Extra Round or a takeover. */
        muted: "text-muted-foreground",
      },
    },
  }
)

/** The Rounds in order, one line each. */
export function HistoryList({ children }: { children: ReactNode }) {
  return <ol className="flex flex-col pt-2">{children}</ol>
}

/**
 * One Round: its number on the left, what happened, and a line under it
 * (Dealer, Swimmer by choice …). A Bomb gets its icon; the end is bold; an
 * Extra Round or a takeover is muted.
 */
export function HistoryEntry({
  round,
  text,
  meta,
  bomb = false,
  end = false,
  muted = false,
}: {
  round: ReactNode
  text: ReactNode
  meta: ReactNode
  bomb?: boolean
  end?: boolean
  muted?: boolean
}) {
  return (
    <li
      data-slot="history-entry"
      className="grid grid-cols-[50px_minmax(0,1fr)] border-b border-border py-3"
    >
      <span className="pl-1 text-[15px] text-muted-foreground tabular-nums">
        {round}
      </span>
      <span className="flex flex-col gap-0.5">
        <span
          className={historyTextVariants({
            kind: end ? "end" : muted ? "muted" : "default",
          })}
        >
          {bomb ? (
            <Bomb
              className="mt-0.5 size-4.5 shrink-0 text-bomb"
              aria-label="Bombe"
            />
          ) : null}
          {text}
        </span>
        <span className="text-[13px] text-muted-foreground">{meta}</span>
      </span>
    </li>
  )
}
