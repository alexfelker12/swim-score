import { useLayoutEffect, useRef, useState } from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Circle, CloudOff, Eye, Waves } from "lucide-react"
import { DealerBadge } from "@/components/dealer-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  formatCountdown,
  formatOfflineFor,
  takeoverOpensAt,
} from "@/lib/takeover"
import { liveUpdates } from "@/lib/use-live-game"
import { useServerNow } from "@/lib/use-server-now"
import { cn } from "@/lib/utils"
import type { ComponentProps, ReactNode } from "react"
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
        return (
          <PlayerRow
            key={participant.id}
            state={
              out
                ? "out"
                : bombMode && tappable
                  ? "bomb"
                  : swimming
                    ? "swimmer"
                    : "default"
            }
            height={height}
            onTap={tappable ? () => onTap(participant.id) : undefined}
            aria-label={
              tappable
                ? `${participant.name}, ${status}. Tippen: ${bombMode ? "wirft die Bombe" : "verliert die Runde"}`
                : `${participant.name}, ${status}`
            }
          >
            <PlayerRowTitle>
              <PlayerRowName>{participant.name}</PlayerRowName>
              {participant.id === scorekeeperParticipantId ? (
                <Badge variant="muted">zählt</Badge>
              ) : null}
            </PlayerRowTitle>
            {out ? (
              <PlayerRowOut />
            ) : swimming ? (
              <SwimmerLabel />
            ) : (
              <LifeBar lives={state.lives} of={startingLives} />
            )}
            {participant.id === dealer && !out ? (
              <DealerBadge placement="corner" />
            ) : null}
          </PlayerRow>
        )
      })}
    </div>
  )
}

const playerRowVariants = cva(
  "relative flex w-full shrink-0 items-center justify-between gap-3 rounded-[14px] border-[1.5px] bg-card px-4.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  {
    variants: {
      state: {
        default: "border-border",
        /** The Swimmer: blue border. */
        swimmer: "border-swimmer",
        /** Waiting for who threw the Bomb: yellow border. */
        bomb: "border-bomb",
        /** Out: dashed, see-through, keeps its place. */
        out: "border-dashed border-border bg-transparent opacity-50",
      },
    },
    defaultVariants: { state: "default" },
  }
)

/**
 * A Participant's row in the Game (`i05-schwimmer`). With `onTap` the whole
 * row is a button ("verliert die Runde"); `height` comes from the table so
 * all rows fit, and from 70 px on the name grows.
 *
 * ```tsx
 * <PlayerRow state="swimmer" height={64} onTap={…} aria-label="…">
 *   <PlayerRowTitle><PlayerRowName>Dario</PlayerRowName></PlayerRowTitle>
 *   <SwimmerLabel />
 *   <DealerBadge placement="corner" />
 * </PlayerRow>
 * ```
 */
export function PlayerRow({
  state,
  height,
  onTap,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "onClick"> &
  VariantProps<typeof playerRowVariants> & {
    height: number
    onTap?: () => void
  }) {
  const shared = {
    "data-slot": "player-row",
    "data-size": height >= 70 ? "lg" : "default",
    style: { height },
    className: cn(
      "group/player-row",
      playerRowVariants({ state }),
      onTap &&
        "transition-[background-color,scale] duration-100 active:scale-[0.98] active:bg-muted motion-reduce:active:scale-100",
      className
    ),
  }
  return onTap ? (
    <ButtonPrimitive
      {...(props as ComponentProps<typeof ButtonPrimitive>)}
      {...shared}
      onClick={onTap}
    >
      {children}
    </ButtonPrimitive>
  ) : (
    <div role="group" {...shared} {...props}>
      {children}
    </div>
  )
}

/** Name and a badge after it ("zählt"), on the left. */
export function PlayerRowTitle({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      data-slot="player-row-title"
      className={cn("flex min-w-0 items-center gap-2.5", className)}
      {...props}
    />
  )
}

/** The name, 18 px / 600; 21 px in tall rows. */
export function PlayerRowName({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="player-row-name"
      className={cn(
        "truncate text-lg font-semibold group-data-[size=lg]/player-row:text-[21px]",
        className
      )}
      {...props}
    />
  )
}

/** "ausgeschieden" in place of the lives. */
export function PlayerRowOut() {
  return (
    <span className="shrink-0 text-sm text-muted-foreground">
      ausgeschieden
    </span>
  )
}

const lifeSegmentVariants = cva("h-2.5 flex-1 rounded-[5px]", {
  variants: {
    state: {
      left: "bg-foreground",
      /** A lost life stays as an outline (`--life-off`). */
      lost: "shadow-[inset_0_0_0_1.5px_var(--life-off)]",
    },
  },
})

/** Lives as a bar of segments; lost ones stay as an outline. */
export function LifeBar({ lives, of }: { lives: number; of: number }) {
  return (
    <span aria-hidden="true" className="flex w-21 shrink-0 gap-1">
      {Array.from({ length: of }, (_, index) => (
        <span
          key={index}
          className={lifeSegmentVariants({
            state: index < lives ? "left" : "lost",
          })}
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

const statusLineVariants = cva("flex items-center gap-2.5 rounded-xl text-sm", {
  variants: {
    variant: {
      /** 40 px on `muted`. */
      default: "min-h-10 bg-muted pr-1 pl-3.5",
      /** With "Übernehmen": 48 px. */
      takeover: "min-h-12 bg-muted py-1 pr-1 pl-3.5",
      /** The Scorekeeper offline: inverted. */
      offline: "min-h-10 bg-foreground px-3.5 font-semibold text-background",
    },
  },
  defaultVariants: { variant: "default" },
})

/**
 * The line under the header saying who keeps score: "Du zählst · alle sehen
 * live mit" for the Scorekeeper, "Ben zählt" for the other Participants,
 * "Du schaust zu, Ben zählt" for Spectators. While the Scorekeeper is
 * offline: "Anna ist seit 0:40 offline". The Scorekeeper's own device without
 * a connection: "Offline, 3 Runden nicht gesendet" (ADR 0003), inverted.
 * With `onTakeOver`, the viewer may
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
  unsentRounds = null,
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
  /** The Scorekeeper's Rounds not sent yet, while offline; null when online. */
  unsentRounds?: number | null
}) {
  const now = useServerNow(serverTime ?? new Date(), offlineSince !== null)
  if (viewer === "scorekeeper" && unsentRounds !== null) {
    return (
      <div className="shrink-0 px-4 pb-2" role="status">
        <div className={statusLineVariants({ variant: "offline" })}>
          <CloudOff className="size-4.5 shrink-0" aria-hidden="true" />
          Offline,{" "}
          {unsentRounds === 0
            ? "Änderungen nicht gesendet"
            : unsentRounds === 1
              ? "1 Runde nicht gesendet"
              : `${unsentRounds} Runden nicht gesendet`}
        </div>
      </div>
    )
  }
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
        className={statusLineVariants({
          variant: onTakeOver ? "takeover" : "default",
        })}
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
                <Button
                  variant="soft"
                  size="xs"
                  onClick={onTakeOver}
                  disabled={takingOver}
                >
                  Übernehmen
                </Button>
              )
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

/** The bar at the bottom with the last Event; `children` are `LastEventAction`s. */
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

/**
 * A step in the bar with the last Event: a 44 px icon ("Rückgängig",
 * "Stechen angeben") so the Event's text keeps the width, or with
 * `showLabel` icon and text.
 */
export function LastEventAction({
  label,
  showLabel = false,
  tone = "default",
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label" | "variant" | "size"> & {
  label: string
  showLabel?: boolean
  /** `primary` for "Stechen angeben". */
  tone?: "default" | "primary"
}) {
  return (
    <Button
      variant={tone === "primary" ? "raised-primary" : "raised"}
      size={showLabel ? "sm" : "icon"}
      aria-label={showLabel ? undefined : label}
      title={label}
      {...props}
    >
      {children}
      {showLabel ? label : null}
    </Button>
  )
}

const tablePromptVariants = cva(
  "flex h-8.5 shrink-0 items-center px-5 text-[15px]",
  {
    variants: {
      state: {
        default: "text-muted-foreground",
        bomb: "font-semibold text-bomb",
      },
    },
  }
)

/** "Wer hat die Runde verloren?" over the rows; yellow while waiting for the Bomb's thrower. */
export function TablePrompt({
  bomb = false,
  children,
}: {
  bomb?: boolean
  children: ReactNode
}) {
  return (
    <p className={tablePromptVariants({ state: bomb ? "bomb" : "default" })}>
      {children}
    </p>
  )
}

/** "2 Ausgeschiedene ausgeblendet. Anzeigen" under the rows. */
export function HiddenOutNote({
  count,
  onShow,
}: {
  count: number
  onShow: () => void
}) {
  return (
    <p className="shrink-0 px-4 pt-1 text-center text-[15px] text-muted-foreground">
      {count === 1
        ? "1 Ausgeschiedener ausgeblendet."
        : `${count} Ausgeschiedene ausgeblendet.`}{" "}
      <Button variant="link" onClick={onShow}>
        Anzeigen
      </Button>
    </p>
  )
}

/** The loser in the Tiebreak sheet: fixed, "verloren" beside the name. */
export function TiebreakLoser({ name }: { name: string }) {
  return (
    <div className="flex h-13 min-w-0 items-center justify-between gap-2 rounded-xl border-[1.5px] border-border bg-muted px-3.5">
      <span className="truncate font-semibold">{name}</span>
      <span className="shrink-0 text-[13px] text-muted-foreground">
        verloren
      </span>
    </div>
  )
}
