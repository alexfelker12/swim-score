import { useLayoutEffect, useRef, useState } from "react"
import { Circle, Eye, Waves } from "lucide-react"
import { Badge } from "@/components/badge"
import { DealerBadge } from "@/components/dealer-badge"
import {
  formatCountdown,
  formatOfflineFor,
  takeoverOpensAt,
} from "@/lib/takeover"
import { liveUpdates } from "@/lib/use-live-game"
import { useServerNow } from "@/lib/use-server-now"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"
import type { ParticipantState } from "@/rules-engine"

// The Game table: one row per Participant, for the Scorekeeper, the other
// Participants and Spectators alike.

const ROW_GAP = 6

/**
 * One row per Participant in Seating Order, high enough to fill the space
 * without scrolling (52–88 px), so 9 players fit on a phone.
 */
export function ParticipantRows({
  participants,
  states,
  dealer,
  startingLives,
  scorekeeperParticipantId = null,
  bombMode = false,
  hideOut = false,
  onTap = null,
}: {
  participants: ReadonlyArray<{ id: string; name: string }>
  states: Array<ParticipantState>
  dealer: string
  startingLives: number
  /** Marked "zählt"; only for those who do not keep score themselves. */
  scorekeeperParticipantId?: string | null
  bombMode?: boolean
  /** Leave out the rows of Participants who are Out. */
  hideOut?: boolean
  /** Null when the viewer does not record, or the Game is about to end. */
  onTap?: ((id: string) => void) | null
}) {
  const box = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(64)
  const rows = participants
    .map((participant, seat) => ({ participant, state: states[seat] }))
    .filter(({ state }) => !(hideOut && state.status === "out"))
  const count = rows.length
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const fit = () => {
      const free = element.clientHeight - ROW_GAP * (count - 1)
      setHeight(Math.max(52, Math.min(88, Math.floor(free / count))))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [count])
  const largeText = height >= 70

  return (
    <div
      ref={box}
      className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-2"
    >
      {rows.map(({ participant, state }) => {
        const out = state.status === "out"
        const swimming = state.status === "swimming"
        const status = out
          ? "ausgeschieden"
          : swimming
            ? "schwimmt"
            : `${state.lives} Leben`
        const tappable = onTap !== null && !out
        const className = cn(
          "relative flex w-full shrink-0 items-center justify-between gap-3 rounded-[14px] border-[1.5px] bg-card px-4.5 text-left",
          out
            ? "border-dashed border-border bg-transparent opacity-50"
            : bombMode && tappable
              ? "border-bomb"
              : swimming
                ? "border-swimmer"
                : "border-border"
        )
        const content = (
          <>
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "truncate font-semibold",
                  largeText ? "text-[21px]" : "text-lg"
                )}
              >
                {participant.name}
              </span>
              {participant.id === scorekeeperParticipantId ? (
                <Badge tone="muted">zählt</Badge>
              ) : null}
            </span>
            {out ? (
              <span className="shrink-0 text-sm text-muted-foreground">
                ausgeschieden
              </span>
            ) : swimming ? (
              <SwimmerLabel />
            ) : (
              <LifeBar lives={state.lives} of={startingLives} />
            )}
            {participant.id === dealer && !out ? (
              <DealerBadge placement="corner" />
            ) : null}
          </>
        )
        return tappable ? (
          <button
            key={participant.id}
            type="button"
            style={{ height }}
            onClick={() => onTap(participant.id)}
            aria-label={`${participant.name}, ${status}. Tippen: ${bombMode ? "wirft die Bombe" : "verliert die Runde"}`}
            className={className}
          >
            {content}
          </button>
        ) : (
          <div
            key={participant.id}
            style={{ height }}
            aria-label={`${participant.name}, ${status}`}
            role="group"
            className={className}
          >
            {content}
          </div>
        )
      })}
    </div>
  )
}

/** Lives as a bar of segments; lost ones stay as an outline. */
export function LifeBar({ lives, of }: { lives: number; of: number }) {
  return (
    <span aria-hidden="true" className="flex w-21 shrink-0 gap-1">
      {Array.from({ length: of }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-2.5 flex-1 rounded-[5px]",
            index < lives
              ? "bg-foreground"
              : "shadow-[inset_0_0_0_1.5px_var(--life-off)]"
          )}
        />
      ))}
    </span>
  )
}

export function SwimmerLabel() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[15px] font-semibold text-swimmer">
      <Waves className="size-5.5" aria-hidden="true" />
      schwimmt
    </span>
  )
}

/**
 * The line under the header saying who keeps score: "Du zählst · alle sehen
 * live mit" for the Scorekeeper, "Ben zählt" for the other Participants,
 * "Du schaust zu, Ben zählt" for Spectators. While the Scorekeeper is
 * offline: "Anna ist seit 0:40 offline". With `onTakeOver`, the viewer may
 * take over (ADR 0003): at once, or after a countdown while the Scorekeeper
 * has only just gone offline.
 */
export function ScorekeeperStatus({
  viewer,
  scorekeeper,
  offlineSince = null,
  serverTime,
  onTakeOver,
  takingOver = false,
}: {
  viewer: "scorekeeper" | "participant" | "spectator"
  /** Display Name; null once the account is deleted. */
  scorekeeper: string | null
  /** Since when the Scorekeeper's device is offline. */
  offlineSince?: Date | null
  /** The server's clock when the Game was loaded. */
  serverTime?: Date
  onTakeOver?: () => void
  takingOver?: boolean
}) {
  const now = useServerNow(serverTime ?? new Date(), offlineSince !== null)
  const offlineFor = offlineSince ? now.getTime() - offlineSince.getTime() : 0
  const opensIn = offlineSince
    ? takeoverOpensAt(offlineSince).getTime() - now.getTime()
    : 0
  const who = !scorekeeper ? (
    "niemand zählt"
  ) : offlineSince ? (
    <>
      <span className="font-semibold">{scorekeeper}</span> ist seit{" "}
      {/* The clock differs between server and browser by a moment. */}
      <span className="tabular-nums" suppressHydrationWarning>
        {formatOfflineFor(offlineFor)}
      </span>{" "}
      offline
    </>
  ) : (
    <>
      <span className="font-semibold">{scorekeeper}</span> zählt
    </>
  )
  return (
    <div className="shrink-0 px-4 pb-2">
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-xl bg-muted pr-1 pl-3.5 text-sm",
          onTakeOver ? "min-h-12 py-1" : "min-h-10"
        )}
      >
        {viewer === "scorekeeper" ? (
          <>
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-primary"
            />
            <span className="font-semibold">Du zählst</span>
            {liveUpdates ? (
              <span className="ml-auto truncate pr-2.5 text-muted-foreground">
                alle sehen live mit
              </span>
            ) : null}
          </>
        ) : (
          <>
            {offlineSince ? (
              <Circle
                className="size-2.5 shrink-0 text-muted-foreground"
                strokeWidth={3}
                aria-hidden="true"
              />
            ) : viewer === "spectator" ? (
              <Eye
                className="size-4.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            ) : null}
            <span className="min-w-0 flex-1 truncate first-letter:uppercase">
              {viewer === "spectator" ? <>Du schaust zu, {who}</> : who}
            </span>
            {onTakeOver ? (
              opensIn > 0 ? (
                <span
                  className="shrink-0 pr-2.5 text-muted-foreground tabular-nums"
                  suppressHydrationWarning
                >
                  Übernehmen in {formatCountdown(opensIn)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onTakeOver}
                  disabled={takingOver}
                  className="h-9 shrink-0 rounded-[10px] bg-primary-muted px-3.5 text-sm font-semibold text-primary disabled:opacity-40"
                >
                  Übernehmen
                </button>
              )
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

/** The bar at the bottom with the last Event; `children` are its actions. */
export function LastEventBar({
  last,
  emptyText,
  children,
}: {
  last: { round: number; text: string } | null
  /** Before the first Event. */
  emptyText: string
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-14 items-center gap-2 rounded-[14px] bg-muted py-1.5 pr-1.5 pl-3.5">
      {last ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted-foreground">
            Runde {last.round}
          </span>
          <span className="text-[15px] leading-snug font-medium text-pretty">
            {last.text}
          </span>
        </div>
      ) : (
        <span className="flex-1 text-[15px] text-muted-foreground">
          {emptyText}
        </span>
      )}
      {children}
    </div>
  )
}
