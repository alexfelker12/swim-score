import { Unlink } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Logo } from "@/components/logo"
import { Page } from "@/components/page"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/**
 * The page for a link that no longer leads anywhere (an Invite renewed, a
 * Game over, a used password link): logo, icon beside the heading,
 * explanation, one way on.
 *
 * ```tsx
 * <LinkGone>
 *   <LinkGoneContent>
 *     <LinkGoneTitle>Dieses Spiel ist vorbei</LinkGoneTitle>
 *     <LinkGoneDescription>…</LinkGoneDescription>
 *   </LinkGoneContent>
 *   <LinkGoneFooter>
 *     <Button size="xl" nativeButton={false} render={<Link to="/" />}>
 *       Swim Score öffnen
 *     </Button>
 *   </LinkGoneFooter>
 * </LinkGone>
 * ```
 */
export function LinkGone({ children, ...props }: ComponentProps<"div">) {
  return (
    <Page data-slot="link-gone" {...props}>
      <header className="flex h-14 shrink-0 items-center px-5">
        <Logo />
      </header>
      {children}
    </Page>
  )
}

/** Heading and explanation, centred on the page. */
export function LinkGoneContent({
  className,
  ...props
}: ComponentProps<"main">) {
  return (
    <main
      data-slot="link-gone-content"
      className={cn(
        "flex flex-1 flex-col justify-center gap-3.5 px-7 pb-20",
        className
      )}
      {...props}
    />
  )
}

/** The heading with an icon left of it, the broken link unless given. */
export function LinkGoneTitle({
  className,
  children,
  icon: Icon = Unlink,
  ...props
}: ComponentProps<"h1"> & { icon?: LucideIcon }) {
  return (
    <div className="flex items-center gap-3">
      <Icon
        className="size-8 shrink-0 text-muted-foreground"
        strokeWidth={1.8}
        aria-hidden="true"
      />
      <h1
        data-slot="link-gone-title"
        className={cn(
          "text-[26px] leading-[1.2] font-bold text-balance",
          className
        )}
        {...props}
      >
        {children}
      </h1>
    </div>
  )
}

export function LinkGoneDescription({
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      data-slot="link-gone-description"
      className={cn("text-pretty text-muted-foreground", className)}
      {...props}
    />
  )
}

/** The one way on, full width at the foot of the page. */
export function LinkGoneFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="link-gone-footer"
      className={cn("flex flex-col px-4 pb-6", className)}
      {...props}
    />
  )
}
