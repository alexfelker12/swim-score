import { useEffect, useState } from "react"

/**
 * A link to this site at `path`, with copying and the device's share sheet.
 * The URL is null until the page runs in the browser, which alone knows the
 * site's address for sure.
 */
export function useShareLink(
  path: string,
  share: { title: string; text: string }
) {
  const [origin, setOrigin] = useState<string | null>(null)
  useEffect(() => setOrigin(window.location.origin), [])
  const url = origin ? `${origin}${path}` : null
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function copy() {
    if (!url) return
    setError(null)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Kopieren hat nicht geklappt. Markiere den Link von Hand.")
    }
  }

  /** The share sheet where there is one; copying elsewhere. */
  async function shareLink() {
    if (!url) return
    if (!("share" in navigator)) return copy()
    try {
      await navigator.share({ ...share, url })
    } catch {
      // Closing the share sheet is not an error.
    }
  }

  return {
    url,
    /** The URL without "https://", as shown. */
    shownUrl: url?.replace(/^https?:\/\//, "") ?? null,
    copy,
    share: shareLink,
    copied,
    error,
  }
}
