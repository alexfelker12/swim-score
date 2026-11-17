import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * Buttons from docs/design/README.md › Bausteine. Pick look and size here;
 * call sites only add layout classes (width, flex, margin).
 *
 * Touch screens never show `hover:` (Tailwind only applies it on devices
 * that can hover), so every variant also reacts to `active:` and the button
 * shrinks a little while pressed.
 *
 * A link that looks like a button: `<Button nativeButton={false}
 * render={<Link to="…" />}>`.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 border-[1.5px] border-transparent bg-clip-padding whitespace-nowrap transition-[color,background-color,border-color,opacity,scale] duration-100 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40 motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        /** Main action: primary fill. */
        default:
          "bg-primary font-semibold text-primary-foreground hover:bg-primary/90 active:bg-primary/90",
        /** Secondary action: 1.5 px border, no fill ("Abbrechen", "Zur Gruppe"). */
        secondary: "border-border font-medium hover:bg-muted active:bg-muted",
        /** Like secondary, on a card surface (bars, sheets over the page). */
        outline:
          "border-border bg-card font-medium hover:bg-muted active:bg-muted",
        /** Quiet primary action ("Übernehmen", add buttons). */
        soft: "bg-primary-muted font-semibold text-primary hover:bg-primary-muted/70 active:bg-primary-muted/70",
        /** Removes or deletes something: coral fill. */
        destructive:
          "bg-destructive font-semibold text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/90",
        /** Removes something, beside `outline` buttons ("Entfernen" in the picture editor). */
        "destructive-outline":
          "border-border bg-card font-semibold text-destructive hover:bg-destructive-muted active:bg-destructive-muted",
        /** Removes something, as text ("Spiel abbrechen", "Konto löschen"). */
        "destructive-ghost":
          "font-semibold text-destructive hover:bg-destructive-muted active:bg-destructive-muted",
        /** The bomb: border and text `bomb` on `bomb-muted`. */
        bomb: "border-bomb bg-bomb-muted font-semibold text-bomb hover:bg-bomb-muted/70 active:bg-bomb-muted/70",
        /** A chosen filter that opens its choices (the metric on the Leaderboard). */
        selected:
          "border-primary bg-primary-muted text-base font-semibold text-primary hover:bg-primary-muted/70 active:bg-primary-muted/70",
        /** A filter that opens its choices, not highlighted (the Period): border, 16 px / 600, muted icons. */
        picker:
          "border-border text-base font-semibold hover:bg-muted active:bg-muted [&_svg]:text-muted-foreground",
        /** Add something new ("Gruppe anlegen"): dashed border, `primary` text. */
        add: "border-dashed border-border font-semibold text-primary hover:bg-muted active:bg-muted",
        /** Choosing the Swimmer: border `swimmer` on `swimmer-muted`. */
        swimmer:
          "border-swimmer bg-swimmer-muted font-semibold hover:bg-swimmer-muted/70 active:bg-swimmer-muted/70",
        /** Something to add, not there yet ("Nicht dabei" at the start): dashed border. */
        dashed:
          "border-dashed border-border font-semibold hover:bg-muted active:bg-muted",
        /** An action on a `muted` bar (the last Event's Rückgängig): `background` fill. */
        raised:
          "bg-background font-semibold hover:bg-background/70 active:bg-background/70",
        /** The same in the primary colour ("Stechen angeben"). */
        "raised-primary":
          "bg-background font-semibold text-primary hover:bg-background/70 active:bg-background/70",
        /** An icon action in a row in the primary colour (link a Guest). */
        "primary-ghost":
          "font-semibold text-primary hover:bg-primary-muted active:bg-primary-muted",
        /** A quiet text action ("2 ehemalige Spieler"). */
        muted:
          "font-normal text-muted-foreground hover:bg-muted active:bg-muted",
        /** Icon buttons in headers and rows, text buttons without a frame. */
        ghost: "font-medium hover:bg-muted active:bg-muted",
        /** Inline text action in the primary colour. */
        link: "h-auto! px-0! font-semibold text-primary underline-offset-4 hover:underline active:opacity-70",
        /** "Mit Google anmelden" after Google's branding guidelines. */
        google:
          "border border-google-stroke bg-google-fill font-google text-sm/5 font-medium text-google-text active:opacity-80",
      },
      size: {
        /** The page's one main action (start page, "Neues Spiel in …"): 64 px, 17 px. */
        "2xl": "h-16 rounded-[14px] px-4 text-[17px]",
        /** Main buttons, 56 px. */
        xl: "h-14 rounded-[14px] px-4 text-base",
        /** Main buttons where space is tight, 52 px. */
        lg: "h-13 rounded-[14px] px-4 text-base",
        /** Buttons in bars and sheets, 48 px. */
        default: "h-12 rounded-xl px-4 text-[15px]",
        /** Small actions, 44 px (the minimum tap target). */
        sm: "h-11 rounded-xl px-3.5 text-[15px]",
        /** Compact actions inside a row or card, 36 px. */
        xs: "h-9 rounded-[10px] px-3.5 text-sm [&_svg:not([class*='size-'])]:size-4",
        /** Icon button, 44 × 44 px. */
        icon: "size-11 rounded-xl active:scale-90",
        /** Large icon button, 52 × 52 px. */
        "icon-lg": "size-13 rounded-xl active:scale-90",
      },
    },
    compoundVariants: [
      // 12 px inset on the left, 10 px between logo and text, radius as the main buttons.
      { variant: "google", className: "gap-2.5 rounded-[14px] px-3 text-sm/5" },
      // Choosing the Swimmer: 60 px rows with the name at 18 px.
      { variant: "swimmer", className: "h-15 px-4.5 text-lg" },
      // A text link on its own ("Bild doch behalten") keeps the 44 px tap target.
      { variant: "link", size: "sm", className: "h-11! px-4!" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
