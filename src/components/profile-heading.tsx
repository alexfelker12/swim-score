import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/**
 * Avatar beside name and a line under it, at the top of the own profile.
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
export function ProfileHeading({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="profile-heading"
      className={cn("flex items-center gap-3.5", className)}
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
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      data-slot="profile-heading-title"
      className={cn("truncate text-[22px] leading-tight font-bold", className)}
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
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}
