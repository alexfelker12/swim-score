import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"

/**
 * A part of a page that opens and closes (docs/design/README.md ›
 * Bausteine): closed by default unless `defaultOpen`.
 *
 * ```tsx
 * <Collapsible render={<Section aria-labelledby="former" />}>
 *   <SectionTitle>
 *     <CollapsibleTrigger id="former">Ehemalige Spieler (3)</CollapsibleTrigger>
 *   </SectionTitle>
 *   <CollapsibleContent>…</CollapsibleContent>
 * </Collapsible>
 * ```
 */
function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

/**
 * What opens and closes it, across the width with a chevron on the right
 * that turns when open; 44 px high to tap, with press feedback. Put it into
 * the section's heading (`SectionTitle`), whose type it takes, so the
 * heading stays a heading for screen readers.
 */
function CollapsibleTrigger({
  className,
  children,
  ...props
}: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn(
        "-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-2 rounded-lg px-2 text-left outline-none select-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:bg-muted [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-muted-foreground [&>svg]:transition-transform [&>svg]:duration-200 data-panel-open:[&>svg]:rotate-180 motion-reduce:[&>svg]:transition-none",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown aria-hidden="true" />
    </CollapsiblePrimitive.Trigger>
  )
}

/** What opens: sliding open and closed in height, not with reduced motion. */
function CollapsibleContent({
  className,
  ...props
}: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={cn(
        "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
