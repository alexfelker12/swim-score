import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/**
 * A titled part of a page ("Spieler", "Verwalter", "Wer bist du?", a month in
 * the list of Games).
 *
 * ```tsx
 * <Section aria-labelledby="players">
 *   <SectionTitle id="players">Spieler</SectionTitle>
 *   …
 *   <SectionDescription>Entfernte Spieler bleiben …</SectionDescription>
 * </Section>
 * ```
 */
const sectionVariants = cva("flex flex-col gap-2", {
  variants: {
    align: {
      start: "",
      /** Text centred (the Invite page around the QR code). */
      center: "text-center",
    },
  },
  defaultVariants: { align: "start" },
})

export function Section({
  className,
  align,
  ...props
}: ComponentProps<"section"> & VariantProps<typeof sectionVariants>) {
  return (
    <section
      data-slot="section"
      className={cn(sectionVariants({ align }), className)}
      {...props}
    />
  )
}

const sectionTitleVariants = cva("text-pretty wrap-break-word", {
  variants: {
    variant: {
      /** 17 px / 600. */
      default: "text-[17px] font-semibold",
      /** A quiet heading in a list (the month over its Games), 15 px / 600 muted. */
      muted: "text-[15px] font-semibold text-muted-foreground",
      /** A name standing on its own (the Group under its QR code), 20 px / 700. */
      lg: "text-xl font-bold",
      /** The page's own heading where there is no header title (an Invite's Group), 30 px / 700. */
      page: "text-[30px] leading-[1.15] font-bold",
    },
  },
  defaultVariants: { variant: "default" },
})

export function SectionTitle({
  className,
  variant = "default",
  as: Tag = "h2",
  ...props
}: ComponentProps<"h2"> &
  VariantProps<typeof sectionTitleVariants> & {
    /** The heading level; `h1` where it is the page's heading. */
    as?: "h1" | "h2"
  }) {
  return (
    <Tag
      data-slot="section-title"
      className={cn(sectionTitleVariants({ variant }), className)}
      {...props}
    />
  )
}

/** 15 px, muted. `<strong>` inside stands out (a name). */
export function SectionDescription({
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      data-slot="section-description"
      className={cn(
        "text-[15px] text-pretty text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground",
        className
      )}
      {...props}
    />
  )
}
