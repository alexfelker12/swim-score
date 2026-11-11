import { Link } from "@tanstack/react-router"
import { Unlink } from "lucide-react"
import { primaryButtonClass } from "@/components/buttons"
import { Logo } from "@/components/logo"
import type { ReactNode } from "react"

/**
 * The page for a link that no longer leads anywhere (an Invite renewed, a
 * Game over): logo, icon beside the heading, explanation, one way on.
 */
export function LinkGone({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action: string
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center px-5">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col justify-center gap-3.5 px-7 pb-20">
        <div className="flex items-center gap-3">
          <Unlink
            className="size-8 shrink-0 text-muted-foreground"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <h1 className="text-[26px] leading-[1.2] font-bold text-balance">
            {title}
          </h1>
        </div>
        <p className="text-pretty text-muted-foreground">{children}</p>
      </main>
      <div className="px-4 pb-6">
        <Link to="/" className={primaryButtonClass}>
          {action}
        </Link>
      </div>
    </div>
  )
}
