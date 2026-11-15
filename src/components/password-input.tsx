import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import type { ComponentProps } from "react"

/**
 * A password input with the eye / eye-off switch inside the field. Takes the
 * input's props (`id`, `aria-invalid`, `aria-describedby`, `autoComplete` …).
 */
export function PasswordInput(
  props: Omit<ComponentProps<typeof InputGroupInput>, "type">
) {
  const [shown, setShown] = useState(false)
  return (
    <InputGroup>
      <InputGroupInput type={shown ? "text" : "password"} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon"
          aria-label={shown ? "Passwort verbergen" : "Passwort anzeigen"}
          aria-pressed={shown}
          onClick={() => setShown(!shown)}
        >
          {shown ? <EyeOff /> : <Eye />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
