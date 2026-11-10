import { cn } from "@/lib/utils"

/**
 * The Dealer's pill. In the game view it hangs off the lower left corner of
 * the row ("corner"); elsewhere it sits next to the name ("inline").
 */
export function DealerBadge({
  placement = "inline",
}: {
  placement?: "inline" | "corner"
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-card bg-[image:linear-gradient(var(--primary-muted),var(--primary-muted))] px-2 text-xs leading-none font-semibold text-primary",
        placement === "corner" &&
          "absolute -bottom-1.75 -left-1.5 z-[2] ring-2 ring-background"
      )}
    >
      <CardsIcon />
      Dealer
    </span>
  )
}

/** Two playing cards (Lucide has no such icon). */
function CardsIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="6" width="12" height="16" rx="2" />
      <path d="M9 2h10a2 2 0 0 1 2 2v14" />
    </svg>
  )
}
