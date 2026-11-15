import { Check, Copy } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

/** A link as a read-only field with a copy button, for Invites and Spectator links. */
export function LinkField({
  shownUrl,
  copied,
  onCopy,
  label = "Link",
}: {
  shownUrl: string | null
  copied: boolean
  onCopy: () => void
  /** What the link is, for screen readers. */
  label?: string
}) {
  return (
    <InputGroup>
      <InputGroupInput
        readOnly
        value={shownUrl ?? ""}
        aria-label={label}
        onFocus={(event) => event.currentTarget.select()}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon"
          variant="outline"
          aria-label={copied ? "Kopiert" : "Link kopieren"}
          onClick={onCopy}
          disabled={!shownUrl}
        >
          {copied ? <Check /> : <Copy />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
