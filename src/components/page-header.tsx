import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ComponentProps, ReactElement } from "react"

/**
 * The page header from docs/design/README.md › Bausteine (Kopf): 56 px, a
 * way back on the left, the title centred, icon buttons on the right.
 *
 * ```tsx
 * <PageHeader>
 *   <PageHeaderBack render={<Link to="/" />} label="Zurück zur Startseite" />
 *   <PageHeaderTitle>Profil</PageHeaderTitle>
 * </PageHeader>
 * ```
 */
export function PageHeader({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "grid h-14 shrink-0 grid-cols-[52px_minmax(0,1fr)_52px] items-center px-1",
        className
      )}
      {...props}
    />
  )
}

/** Back, as a link rendered by `render` (e.g. `<Link to="/" />`). */
export function PageHeaderBack({
  render,
  label,
  className,
}: {
  render: ReactElement
  /** Where back leads, for screen readers ("Zurück zur Startseite"). */
  label: string
  className?: string
}) {
  return (
    <Button
      data-slot="page-header-back"
      variant="ghost"
      size="icon"
      nativeButton={false}
      render={render}
      aria-label={label}
      className={cn("col-start-1 justify-self-center", className)}
    >
      <ChevronLeft className="size-6" />
    </Button>
  )
}

/** 17 px / 600, centred. */
export function PageHeaderTitle({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      data-slot="page-header-title"
      className={cn(
        "col-start-2 truncate text-center text-[17px] font-semibold",
        className
      )}
      {...props}
    />
  )
}
