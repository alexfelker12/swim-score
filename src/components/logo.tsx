/** The app mark: rounded square in the primary colour with two waves. */
export function AppMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="8" className="fill-primary" />
      <path
        d="M6 11.5c1.4 0 2.1-1.5 4-1.5s2.6 1.5 4 1.5 2.1-1.5 4-1.5 2.6 1.5 4 1.5"
        className="fill-none stroke-primary-foreground"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M6 17c1.4 0 2.1-1.5 4-1.5s2.6 1.5 4 1.5 2.1-1.5 4-1.5 2.6 1.5 4 1.5"
        className="fill-none stroke-primary-foreground opacity-55"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <AppMark />
      <span className="text-lg font-semibold">Swim Score</span>
    </span>
  )
}
