import { cva, type VariantProps } from "class-variance-authority"
import { Link, useCanGoBack, useRouter } from "@tanstack/react-router"
import { ChevronLeft, X } from "lucide-react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { cloneElement } from "react"
import { backTransition } from "@/lib/page-transitions"
import { cn } from "@/lib/utils"
import type { ComponentProps, ReactElement, ReactNode } from "react"

// Every header is 60 px high, with back 8 px from the left edge and the last
// action 8 px from the right one: going from page to page, nothing in it
// moves.
const pageHeaderVariants = cva("h-15 shrink-0 items-center", {
  variants: {
    variant: {
      /** Back on the left, the title centred, an action on the right. */
      default: "grid grid-cols-[44px_minmax(0,1fr)_44px] gap-x-1 px-2",
      /**
       * Back, then title and a line under it on the left, actions on the
       * right (the Group page).
       */
      start: "grid grid-cols-[44px_minmax(0,1fr)_auto] gap-x-1 px-2",
      /** With the logo, for pages someone opens from a link; something on the right (the start page's avatar, 44 px) sits where the actions do. */
      brand: "flex justify-between pr-2 pl-5",
    },
  },
  defaultVariants: { variant: "default" },
})

/**
 * The page header from docs/design/README.md › Bausteine (Kopf).
 *
 * ```tsx
 * <PageHeader>
 *   <PageHeaderBack render={<Link to="/" />} label="Zurück zur Startseite" />
 *   <PageHeaderTitle>Profil</PageHeaderTitle>
 * </PageHeader>
 *
 * <PageHeader variant="start">
 *   <PageHeaderBack … />
 *   <PageHeaderContent>
 *     <PageHeaderTitle>Donnerstagsrunde</PageHeaderTitle>
 *     <PageHeaderDescription>11 Spieler</PageHeaderDescription>
 *   </PageHeaderContent>
 *   <PageHeaderActions>
 *     <PageHeaderAction render={<Link … />} label="…"><Settings /></PageHeaderAction>
 *   </PageHeaderActions>
 * </PageHeader>
 *
 * <PageHeader variant="brand" />   // just the logo
 * ```
 */
export function PageHeader({
  className,
  variant = "default",
  children,
  ...props
}: ComponentProps<"header"> & VariantProps<typeof pageHeaderVariants>) {
  return (
    <header
      data-slot="page-header"
      data-variant={variant}
      className={cn(
        "group/page-header",
        pageHeaderVariants({ variant }),
        className
      )}
      {...props}
    >
      {variant === "brand" && children === undefined ? <Logo /> : children}
    </header>
  )
}

/**
 * An icon button in the header (44 × 44 px, icon 24 px): a link via
 * `render`, or a button with `onClick`.
 */
export function PageHeaderAction({
  render,
  onClick,
  label,
  className,
  children,
}: {
  render?: ReactElement
  onClick?: () => void
  /** What it does, for screen readers. */
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <Button
      data-slot="page-header-action"
      variant="ghost"
      size="icon"
      nativeButton={render === undefined}
      render={render}
      onClick={onClick}
      aria-label={label}
      className={cn("col-start-3 justify-self-end [&_svg]:size-6!", className)}
    >
      {children}
    </Button>
  )
}

/** Back (chevron) or, for a page opened on top, close (X), on the left. */
export function PageHeaderBack({
  render,
  onClick,
  label,
  icon = "back",
  className,
}: {
  /**
   * A router `Link` to where back leads (it moves like going back, ADR 0014;
   * its own `viewTransition` is replaced); or `onClick` (back in the history).
   */
  render?: ReactElement
  onClick?: () => void
  /** Where back leads, for screen readers ("Zurück zur Startseite"). */
  label: string
  icon?: "back" | "close"
  className?: string
}) {
  return (
    <PageHeaderAction
      render={
        // The link leads back up: it moves like going back (ADR 0014).
        render &&
        cloneElement(render as ReactElement<{ viewTransition?: unknown }>, {
          viewTransition: backTransition(),
        })
      }
      onClick={onClick}
      label={label}
      className={cn("col-start-1 justify-self-start", className)}
    >
      {icon === "close" ? <X /> : <ChevronLeft />}
    </PageHeaderAction>
  )
}

/**
 * Back to where the page came from, in the history; on a page opened
 * directly, to the start page (the Player Profile, a page still loading).
 */
export function PageHeaderBackInHistory() {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return canGoBack ? (
    <PageHeaderBack label="Zurück" onClick={() => router.history.back()} />
  ) : (
    <PageHeaderBack render={<Link to="/" />} label="Zur Startseite" />
  )
}

/** Title and the line under it, in the `start` header. */
export function PageHeaderContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header-content"
      className={cn(
        "col-start-2 flex min-w-0 flex-col items-center group-data-[variant=start]/page-header:items-stretch",
        className
      )}
      {...props}
    />
  )
}

/**
 * 17 px / 600 centred (`size="lg"`: 20 px, "Runde 5"); in the `start`
 * header 20 px / 700 on the left.
 */
export function PageHeaderTitle({
  className,
  size = "default",
  ...props
}: ComponentProps<"h1"> & { size?: "default" | "lg" }) {
  return (
    <h1
      data-slot="page-header-title"
      data-size={size}
      className={cn(
        "col-start-2 max-w-full truncate text-center text-[17px] leading-tight font-semibold group-data-[variant=start]/page-header:text-left group-data-[variant=start]/page-header:text-xl group-data-[variant=start]/page-header:font-bold data-[size=lg]:text-xl",
        className
      )}
      {...props}
    />
  )
}

/** 13 px, muted, under the title ("11 Spieler"). */
export function PageHeaderDescription({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      data-slot="page-header-description"
      className={cn(
        "max-w-full truncate text-[13px] text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

/** Icon buttons on the right. */
export function PageHeaderActions({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header-actions"
      className={cn("col-start-3 flex justify-self-end", className)}
      {...props}
    />
  )
}
