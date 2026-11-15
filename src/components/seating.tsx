import { cva } from "class-variance-authority"
import { GripVertical, Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/**
 * The Seating Order at the start of a Game (`i05-start-spiel`): one row per
 * Participant with a grip to drag, the seat number, the name and a button to
 * take them off the table.
 *
 * ```tsx
 * <SeatList dragging={…}>
 *   <SeatRow dragged={…} first={…} style={…}>
 *     <SeatGrip label="…" onPointerDown={…} onKeyDown={…} />
 *     <SeatNumber>1</SeatNumber>
 *     <SeatName guest>Emil</SeatName>
 *     <SeatRemove label="Emil vom Tisch nehmen" onClick={…} />
 *     <DealerBadge placement="corner" />
 *   </SeatRow>
 * </SeatList>
 * ```
 */
export function SeatList({
  dragging = false,
  className,
  ...props
}: ComponentProps<"ol"> & { dragging?: boolean }) {
  return (
    <ol
      data-slot="seat-list"
      className={cn(
        "flex flex-col gap-2",
        dragging && "select-none",
        className
      )}
      {...props}
    />
  )
}

const seatRowVariants = cva(
  "relative flex h-14 items-center gap-1 rounded-[14px] border-[1.5px] border-border bg-card pr-1",
  {
    variants: {
      state: {
        default: "",
        /** Follows the pointer: lifted, primary border. */
        dragged: "z-10 border-primary shadow-lg",
        /** Another row is dragged: this one slides to make room. */
        moving: "transition-[translate] duration-150",
      },
    },
  }
)

export function SeatRow({
  dragged = false,
  moving = false,
  first = false,
  className,
  ...props
}: ComponentProps<"li"> & {
  /** Follows the pointer: lifted, primary border. */
  dragged?: boolean
  /** Another row is dragged: this one slides to make room. */
  moving?: boolean
  /** The Dealer's seat: drawn above the row below, which its badge overlaps. */
  first?: boolean
}) {
  return (
    <li
      data-slot="seat-row"
      className={cn(
        seatRowVariants({
          state: dragged ? "dragged" : moving ? "moving" : "default",
        }),
        first && !dragged && "z-[1]",
        className
      )}
      {...props}
    />
  )
}

/** The grip: drag with finger or mouse, or move with the arrow keys. */
export function SeatGrip({
  label,
  dragged = false,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label" | "variant" | "size"> & {
  label: string
  dragged?: boolean
}) {
  return (
    <Button
      variant="muted"
      size="icon"
      aria-label={label}
      className={cn(
        "touch-none active:scale-100",
        dragged ? "cursor-grabbing" : "cursor-grab",
        className
      )}
      {...props}
    >
      <GripVertical />
    </Button>
  )
}

export function SeatNumber(props: ComponentProps<"span">) {
  return (
    <span
      className="w-6 shrink-0 text-center text-[15px] text-muted-foreground tabular-nums"
      {...props}
    />
  )
}

/** The name, 17 px / 600, with "Gast" after it for a Guest. */
export function SeatName({
  guest = false,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { guest?: boolean }) {
  return (
    <span
      className={cn("flex min-w-0 flex-1 items-center gap-2", className)}
      {...props}
    >
      <span className="truncate text-[17px] font-semibold">{children}</span>
      {guest ? <GuestNote /> : null}
    </span>
  )
}

/** "Gast" beside a name. */
export function GuestNote() {
  return <Badge variant="plain">Gast</Badge>
}

export function SeatRemove({
  label,
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label" | "variant" | "size"> & {
  label: string
}) {
  return (
    <Button variant="muted" size="icon" aria-label={label} {...props}>
      <X />
    </Button>
  )
}

/** Someone of the Group not at the table yet: tap to seat them. */
export function SeatCandidate({
  name,
  guest = false,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "size" | "children"> & {
  name: string
  guest?: boolean
}) {
  return (
    <Button
      variant="dashed"
      size="lg"
      aria-label={`${name} an den Tisch setzen`}
      className="w-full justify-start"
      {...props}
    >
      <span className="truncate text-[17px]">{name}</span>
      {guest ? <GuestNote /> : null}
      <Plus className="ml-auto text-primary" />
    </Button>
  )
}
