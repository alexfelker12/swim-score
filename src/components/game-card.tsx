import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import type { ComponentProps } from "react"

/**
 * A Game in the Group's list (`i05-gruppe-spiele`): a running Game in the
 * primary colour, a finished one plain, a cancelled one dashed. Rendered as
 * a link through `render`. Under the title its facts with icons, each on its
 * own, so a long name shortens instead of breaking the line (#60).
 *
 * ```tsx
 * <GameCard status="finished" render={<Link to="/games/$gameId" … />}>
 *   <GameCardHeader>
 *     <GameCardTitle>
 *       <Trophy /> <GameCardName>Carla</GameCardName> gewinnt
 *     </GameCardTitle>
 *     <GameCardDate>Do., 29. Okt.</GameCardDate>
 *   </GameCardHeader>
 *   <GameCardFacts>
 *     <GameCardFact icon={Users} label="Teilnehmer">7</GameCardFact>
 *     <GameCardFact icon={Waves} label="Schwimmer" swimmer>Ben</GameCardFact>
 *   </GameCardFacts>
 * </GameCard>
 * ```
 */
export function GameCard({
  status,
  ...props
}: Omit<ComponentProps<typeof Card>, "variant" | "size"> & {
  status: "running" | "finished" | "cancelled"
}) {
  return (
    <Card
      data-status={status}
      variant={
        status === "running"
          ? "primary"
          : status === "cancelled"
            ? "dashed"
            : "default"
      }
      size="sm"
      {...props}
    />
  )
}

export const GameCardHeader = CardHeader

/**
 * The title; an icon before it at 18 px (a finished Game's trophy in the
 * primary colour, a cancelled sign).
 */
export function GameCardTitle({
  className,
  ...props
}: ComponentProps<typeof CardTitle>) {
  return (
    <CardTitle
      className={cn(
        "flex min-w-0 items-center gap-1.5 [&>svg]:size-4.5 [&>svg]:shrink-0 group-data-[status=finished]/card:[&>svg]:text-primary",
        className
      )}
      {...props}
    />
  )
}

/** A name in the title: shortened with "…" when it doesn't fit. */
export function GameCardName({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="game-card-name"
      className={cn("min-w-0 truncate", className)}
      {...props}
    />
  )
}

/** The facts under the title, side by side, wrapping between them. */
export function GameCardFacts({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="game-card-facts"
      className={cn(
        "flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

/**
 * One fact with its icon ("7", "12 Runden"); `label` names it for screen
 * readers where the icon alone says it. `swimmer`: in the Swimmer's blue.
 * A long value (a name) shortens.
 */
export function GameCardFact({
  icon: Icon,
  label,
  swimmer = false,
  className,
  children,
  ...props
}: ComponentProps<"span"> & {
  icon: LucideIcon
  label?: string
  swimmer?: boolean
}) {
  return (
    <span
      data-slot="game-card-fact"
      data-swimmer={swimmer || undefined}
      className={cn(
        "flex max-w-full min-w-0 items-center gap-1.5 data-swimmer:text-swimmer",
        className
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {label ? <span className="sr-only">{label}: </span> : null}
      <span className="truncate">{children}</span>
    </span>
  )
}

/** When it was played, top right, 14 px muted. */
export function GameCardDate({
  className,
  ...props
}: ComponentProps<typeof CardAction>) {
  return (
    <CardAction
      className={cn(
        "row-span-1 pt-0.5 text-sm text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

/**
 * "● Läuft, Runde 5": the running Game's first line, in the primary colour.
 * `size="lg"` ("● Spiel läuft" on the start page): 15 px, 10 px after the dot.
 */
export function GameCardStatus({
  className,
  size = "default",
  children,
  ...props
}: ComponentProps<"span"> & { size?: "default" | "lg" }) {
  return (
    <span
      data-slot="game-card-status"
      className={cn(
        "flex items-center font-semibold text-primary",
        size === "lg" ? "gap-2.5 text-[15px]" : "gap-2",
        className
      )}
      {...props}
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
      {children}
    </span>
  )
}

/** The Swimmer, in the Swimmer's blue; `strong` in 600 (the standings on the start page). */
export function GameCardSwimmer({
  className,
  strong = false,
  ...props
}: ComponentProps<"span"> & { strong?: boolean }) {
  return (
    <span
      data-slot="game-card-swimmer"
      className={cn("text-swimmer", strong && "font-semibold", className)}
      {...props}
    />
  )
}
