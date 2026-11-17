import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/**
 * Avatar beside name and a line under it, at the top of the own profile and
 * (`size="lg"`) the Player Profile.
 *
 * ```tsx
 * <ProfileHeading>
 *   <Avatar size="lg">…</Avatar>
 *   <ProfileHeadingContent>
 *     <ProfileHeadingTitle>Anna</ProfileHeadingTitle>
 *     <ProfileHeadingDescription>@anna</ProfileHeadingDescription>
 *   </ProfileHeadingContent>
 * </ProfileHeading>
 * ```
 */
const profileHeadingVariants = cva("group/profile-heading flex items-center", {
  variants: {
    size: {
      default: "gap-3.5",
      /** The Player Profile: name 28 px, line 16 px (with `Avatar size="xl"`). */
      lg: "gap-4",
    },
  },
  defaultVariants: { size: "default" },
})

export function ProfileHeading({
  className,
  size = "default",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof profileHeadingVariants>) {
  return (
    <div
      data-slot="profile-heading"
      data-size={size}
      className={cn(profileHeadingVariants({ size }), className)}
      {...props}
    />
  )
}

export function ProfileHeadingContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="profile-heading-content"
      className={cn("flex min-w-0 flex-col", className)}
      {...props}
    />
  )
}

/** The name, 22 px bold. */
export function ProfileHeadingTitle({
  className,
  as: Tag = "span",
  ...props
}: Omit<ComponentProps<"span">, "ref"> & {
  /** `h1` where the name is the page's heading (Player Profile). */
  as?: "span" | "h1"
}) {
  return (
    <Tag
      data-slot="profile-heading-title"
      className={cn(
        "truncate text-[22px] leading-tight font-bold group-data-[size=lg]/profile-heading:text-[28px]",
        className
      )}
      {...props}
    />
  )
}

export function ProfileHeadingDescription({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      data-slot="profile-heading-description"
      className={cn(
        "text-sm text-muted-foreground group-data-[size=lg]/profile-heading:text-base",
        className
      )}
      {...props}
    />
  )
}
