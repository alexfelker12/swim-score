import { useLayoutEffect, useState } from "react"
import type { Theme } from "@/server/profile"

const darkQuery = "(prefers-color-scheme: dark)"

/**
 * Switches `<html>` to dark or light at once. Colour transitions of single
 * elements (buttons, rows …) would otherwise run each at its own pace and
 * flicker; for this one change none of them runs.
 */
function applyDark(dark: boolean) {
  const root = document.documentElement
  if (root.classList.contains("dark") === dark) return
  const pause = document.createElement("style")
  pause.textContent = "*,*::before,*::after{transition:none!important}"
  document.head.appendChild(pause)
  root.classList.toggle("dark", dark)
  // Apply the new colours while transitions are off, then allow them again.
  void getComputedStyle(root).color
  requestAnimationFrame(() => pause.remove())
}

/**
 * The `<html>` class for the account's theme. The server renders the first
 * one (`className`), "System" is decided by a script before the first paint;
 * after that the class is set here, never by React: React would only add or
 * remove what it rendered itself, and miss the class "System" set.
 * With "System" it follows the device's setting, also when that changes.
 */
export function useTheme(theme: Theme) {
  // What the server rendered; React keeps rendering it so hydration matches.
  const [className] = useState(theme === "dark" ? "dark" : undefined)
  useLayoutEffect(() => {
    if (theme !== "system") {
      applyDark(theme === "dark")
      return
    }
    const query = matchMedia(darkQuery)
    const apply = () => applyDark(query.matches)
    apply()
    query.addEventListener("change", apply)
    return () => query.removeEventListener("change", apply)
  }, [theme])
  return className
}

/**
 * For the "System" theme the class can only be decided in the browser,
 * before the first paint: runs once in the server-rendered page.
 */
export const systemThemeScript = `if(matchMedia("${darkQuery}").matches)document.documentElement.classList.add("dark")`
