/** The initial shown in place of a profile picture: first letter, or "?". */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?"
}
