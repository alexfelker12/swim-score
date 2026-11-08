/**
 * Where to send someone after signing in: only a path on this site. Anything
 * that would leave it (`//evil.com`, `/\evil.com`, `https://…`) becomes "/".
 */
export function safeRedirect(target: unknown): string {
  if (typeof target !== "string" || !target.startsWith("/")) return "/"
  const base = "https://swim-score.invalid"
  try {
    const url = new URL(target, base)
    if (url.origin !== base) return "/"
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/"
  }
}
