import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

/**
 * A row that opens an account's Player Profile; for a Guest (no account)
 * the same content, not tappable.
 */
export function ProfileLink({
  userId,
  className,
  children,
}: {
  userId: string | null
  className?: string
  children: ReactNode
}) {
  return userId ? (
    <Link to="/players/$userId" params={{ userId }} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  )
}
