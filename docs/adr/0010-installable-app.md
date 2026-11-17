# Swim Score is an installable app (PWA)

At the table people open Swim Score from their phone's home screen, not from a browser tab (#49). The app ships a web app manifest with its icons (normal, maskable, monochrome) and, since iOS ignores the manifest for them, an Apple touch icon and one start screen per iPhone size as `apple-touch-startup-image` links. All of them come from the app mark through `docs/design/tools/pwa-icons.py`.

## Decisions

- **Bar colours follow the look.** `theme-color` is the page background of the chosen look; for "System" there is one tag per device setting. The root document renders these tags itself, because the router's head keeps only one meta tag per name. Meta tags can't read CSS variables, so the two background colours are repeated in `src/lib/pwa.ts`, the one allowed exception to "no hex values in code" (`docs/design/README.md`, rule 4).
- **The manifest stays dark.** A manifest can't follow a per-account setting; `theme_color` and `background_color` are the dark background, so the Android start screen is dark also for "Hell". The page's `theme-color` takes over once the app runs.
- **iOS status bar:** iOS has only a style, read when the app starts. "Dunkel" uses `black-translucent` (page behind the bar, white text), "Hell" and "System" use `default` (light bar, dark text): with "System" the server can't know the device setting, and white text over the light look would be unreadable. A changed look reaches the status bar after restarting the app. With `black-translucent` the page needs the safe-area insets (#56).
- **Install hint in the profile, not the browser's.** `beforeinstallprompt` is caught as soon as the app loads and the browser's own mini bar is suppressed; the profile offers "Installieren" instead, and on iOS, which has no such event, explains "Teilen → Zum Home-Bildschirm". In the installed app nothing is shown.

## Consequences

- New iPhone sizes need the generator and the links in `src/lib/pwa.ts` updated together.
- Desktop Chrome and Edge also fire `beforeinstallprompt`, so the profile offers installing there too.
- Starting offline needs a service worker (#51).
