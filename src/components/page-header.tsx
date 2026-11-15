import { cva, type VariantProps } from "class-variance-authority"
import { ChevronLeft, X } from "lucide-react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ComponentProps, ReactElement, ReactNode } from "react"

const pageHeaderVariants = cva("shrink-0", {
  variants: {
    variant: {
      /** 56 px: back on the left, the title centred, actions on the right. */
      default:
        "grid h-14 grid-cols-[52px_minmax(0,1fr)_52px] items-center px-1",
      /**
       * 60 px: back, then title and a line under it on the left, actions on
       * the right (the Group page).
       */
      start: "grid h-15 grid-cols-[52px_minmax(0,1fr)_auto] items-center px-1",
      /** 64 px with the logo, for pages someone opens from a link. */
      brand: "flex h-16 items-center px-5",
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

/** An icon button in the header (44 × 44 px, icon 24 px), as a link via `render`. */
export function PageHeaderAction({
  render,
  label,
  className,
  children,
}: {
  render: ReactElement
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
      nativeButton={false}
      render={render}
      aria-label={label}
      className={cn("[&_svg]:size-6!", className)}
    >
      {children}
    </Button>
  )
}

/** Back (chevron) or, for a page opened on top, close (X), on the left. */
export function PageHeaderBack({
  render,
  label,
  icon = "back",
  className,
}: {
  render: ReactElement
  /** Where back leads, for screen readers ("Zurück zur Startseite"). */
  label: string
  icon?: "back" | "close"
  className?: string
}) {
  return (
    <PageHeaderAction
      render={render}
      label={label}
      className={cn("col-start-1 justify-self-center", className)}
    >
      {icon === "close" ? <X /> : <ChevronLeft />}
    </PageHeaderAction>
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
      className={cn("col-start-2 flex min-w-0 flex-col", className)}
      {...props}
    />
  )
}

/** 17 px / 600 centred; in the `start` header 20 px / 700 on the left. */
export function PageHeaderTitle({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      data-slot="page-header-title"
      className={cn(
        "col-start-2 truncate text-center text-[17px] font-semibold group-data-[variant=start]/page-header:text-left group-data-[variant=start]/page-header:text-xl group-data-[variant=start]/page-header:leading-tight group-data-[variant=start]/page-header:font-bold",
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
      className={cn("text-[13px] text-muted-foreground", className)}
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
