import type { Theme } from "@/server/profile"

// Head entries that make Swim Score an installable app: the manifest, icons,
// and what iOS reads from meta tags instead of the manifest. The assets come
// from docs/design/tools/pwa-icons.py.

/**
 * The page background of each look (`--background` in styles.css), for the
 * browser's and the system's bars. Meta tags can't read CSS variables, so
 * this is the one place besides styles.css with these colours (ADR 0010).
 */
const barColor = { dark: "#131517", light: "#f3f7f7" }

/**
 * The `theme-color` tags for a look; "System" needs one per device setting.
 * Rendered by the root document itself, not through the route's head: the
 * router keeps only one meta tag per name.
 */
export function themeColorTags(theme: Theme) {
  if (theme === "system") {
    return [
      { color: barColor.light, media: "(prefers-color-scheme: light)" },
      { color: barColor.dark, media: "(prefers-color-scheme: dark)" },
    ]
  }
  return [{ color: barColor[theme], media: undefined }]
}

/** Meta tags for the app, besides the bar colours. */
export function appHeadMeta(theme: Theme) {
  return [
    { name: "application-name", content: "Swim Score" },
    { name: "apple-mobile-web-app-title", content: "Swim Score" },
    { name: "mobile-web-app-capable", content: "yes" },
    { name: "apple-mobile-web-app-capable", content: "yes" },
    // iOS has no colour for its status bar, only a style: "black-translucent"
    // draws the page behind it with white text (right for dark), "default"
    // is a light bar with dark text. iOS reads it when the app starts.
    {
      name: "apple-mobile-web-app-status-bar-style",
      content: theme === "dark" ? "black-translucent" : "default",
    },
  ]
}

/**
 * iOS ignores the manifest for splash screens, so every iPhone size needs its
 * own startup image. Generated from the app mark, see public/splash/.
 */
const appleSplashLinks = [
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-1320x2868.png",
    media:
      "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-1260x2736.png",
    media:
      "(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-1206x2622.png",
    media:
      "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-1290x2796.png",
    media:
      "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-1179x2556.png",
    media:
      "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-1284x2778.png",
    media:
      "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-1170x2532.png",
    media:
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-1080x2340.png",
    media:
      "(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-1125x2436.png",
    media:
      "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-1242x2688.png",
    media:
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-828x1792.png",
    media:
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-1242x2208.png",
    media:
      "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-750x1334.png",
    media:
      "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/splash-640x1136.png",
    media:
      "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
]

/** Links for the manifest, icons and iOS start screens. */
export const appHeadLinks = [
  { rel: "manifest", href: "/manifest.json" },
  { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  ...appleSplashLinks,
]
