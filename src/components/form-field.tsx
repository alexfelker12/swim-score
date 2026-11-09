import { useId, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ComponentProps, ReactNode } from "react"

const inputClass =
  "h-13 w-full rounded-xl border-[1.5px] border-border bg-card px-3.5 text-base placeholder:text-muted-foreground focus:border-primary aria-invalid:border-destructive"

type FieldProps = {
  label: string
  hint?: ReactNode
  error?: string | null
  children: (props: {
    id: string
    "aria-describedby"?: string
    "aria-invalid"?: true
  }) => ReactNode
}

/** Label above, hint or error below, as in the design's input pattern. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId()
  const noteId = `${id}-note`
  const note = error ?? hint
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": note ? noteId : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {note ? (
        <span
          id={noteId}
          className={cn(
            "text-[13px] text-pretty",
            error ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {note}
        </span>
      ) : null}
    </div>
  )
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />
}

/** A password input with the eye / eye-off switch. */
export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false)
  const Icon = shown ? EyeOff : Eye
  return (
    <div className="relative">
      <input
        type={shown ? "text" : "password"}
        className={cn(inputClass, "pr-13", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? "Passwort verbergen" : "Passwort anzeigen"}
        aria-pressed={shown}
        className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-[10px] text-muted-foreground"
      >
        <Icon className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}

/** Read-only value styled like an input (e.g. the username in the profile). */
export function ReadOnlyValue({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-13 items-center rounded-xl bg-muted px-3.5 text-muted-foreground">
      {children}
    </span>
  )
}
