import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/**
 * A Game in the Group's list (`i05-gruppe-spiele`): a running Game in the
 * primary colour, a finished one plain, a cancelled one dashed. Rendered as
 * a link through `render`.
 *
 * ```tsx
 * <GameCard status="finished" render={<Link to="/games/$gameId" … />}>
 *   <GameCardHeader>
 *     <GameCardTitle>Carla gewinnt</GameCardTitle>
 *     <GameCardDate>Do., 29. Okt.</GameCardDate>
 *   </GameCardHeader>
 *   <GameCardDescription>
 *     7 Teilnehmer, <GameCardSwimmer>Schwimmer Ben</GameCardSwimmer>
 *   </GameCardDescription>
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

export const GameCardTitle = CardTitle

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

export const GameCardDescription = CardDescription

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
