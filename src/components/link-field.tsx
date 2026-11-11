/** A link as shown text with "Kopieren", for Invites and Spectator links. */
export function LinkField({
  shownUrl,
  copied,
  onCopy,
}: {
  shownUrl: string | null
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="flex h-13 items-center gap-2 rounded-xl bg-muted pr-1.5 pl-3.5">
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground select-all">
        {shownUrl}
      </span>
      <button
        type="button"
        onClick={onCopy}
        disabled={!shownUrl}
        className="h-10 shrink-0 rounded-[10px] bg-card px-3 text-sm font-medium"
      >
        {copied ? "Kopiert" : "Kopieren"}
      </button>
    </div>
  )
}
