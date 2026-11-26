import { PageHeader, PageHeaderBackInHistory } from "@/components/page-header"
import { Page } from "@/components/page"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/**
 * A page while its data loads (#58), its route's `pendingComponent`: the
 * header as far as it needs no data, quiet placeholders for the rest. The
 * page changes at once and the data fills it when it arrives.
 *
 * ```tsx
 * <PageLoading>
 *   <PageLoadingHeader variant="start">
 *     <PageHeaderContent>
 *       <PageLoadingTitle />
 *       <PageLoadingDescription />
 *     </PageHeaderContent>
 *   </PageLoadingHeader>
 *   <PageLoadingContent>
 *     <Skeleton variant="card" className="h-17" />
 *   </PageLoadingContent>
 * </PageLoading>
 * ```
 */
export function PageLoading(props: ComponentProps<typeof Page>) {
  return <Page data-slot="page-loading" {...props} />
}

/**
 * The header with back in the history (where the page came from). Inside,
 * what is known without data as in `PageHeader` ("Profil"), placeholders
 * for the rest.
 */
export function PageLoadingHeader({
  children,
  ...props
}: ComponentProps<typeof PageHeader>) {
  return (
    <PageHeader {...props}>
      <PageHeaderBackInHistory />
      {children}
    </PageHeader>
  )
}

/** A placeholder for the title, as wide as a usual one. */
export function PageLoadingTitle() {
  return (
    <Skeleton
      variant="line"
      className="h-4.5 w-36 group-data-[variant=start]/page-header:h-5 group-data-[variant=start]/page-header:w-40"
    />
  )
}

/** A placeholder for the line under the title. */
export function PageLoadingDescription() {
  return <Skeleton variant="line" className="mt-1.5 h-3 w-24" />
}

/**
 * The placeholders under the header, announced as loading. Lay them out
 * with `Skeleton` (`card` for rows and cards, `line` for text).
 */
export function PageLoadingContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="page-loading-content"
      role="status"
      aria-label="Lädt"
      className={cn("flex flex-col gap-3 px-4 pt-2 pb-6", className)}
      {...props}
    />
  )
}
