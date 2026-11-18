# The installed app feels like an app: free edges, no page gestures, screen on while counting

Small things that tell a web page from an app on the phone (#56, #49). They are app-wide, so they live in the root route and the components, not on the pages.

## Decisions

- **Free edges.** The installed app draws behind the status bar and the home indicator (`viewport-fit=cover`, iOS `black-translucent`, ADR 0010). The root container keeps the edges free (`env(safe-area-inset-*)`), and pages are as high as what is left: `--app-height`, with the utilities `h-app` and `min-h-app` instead of `100svh` (docs/design/README.md › Bausteine). Things positioned outside the root container keep the edges free themselves: sheets at the bottom, the full-screen dialog at both ends, the update hint at the top. Left and right edges are not kept free: the app is portrait and at most 500 px wide.
- **No page gestures.** `overscroll-behavior-y: none` on `html` and `body`: no pull-to-refresh and no bouncing of the whole page; lists and sheets still scroll. Only vertical, so the edge swipes stay.
- **Tapped, not read.** Links, buttons, tabs and the rows of a Game select no text and open no iOS callout on a long press (CSS), and no Android link menu (a `contextmenu` listener, only for touch, so a right click keeps its menu). Fields and plain text stay selectable, rows that are only text too.
- **Screen on while counting.** The Scorekeeper's Game page holds a screen Wake Lock while the Game is not decided; it is taken again when the page comes back (the browser lets go of it while hidden) and released when the page goes, the Game ends or someone else takes over. Without Wake Lock, or when the browser refuses, nothing happens.

## Consequences

- New pages are wrapped in `Page` (`min-h-app`, or `h-app` with `height="screen"`), not `min-h-svh`.
- With 9 players on a phone as high as an iPhone 14 (844 pt), the rows of a Game are at their 52 px minimum and the list scrolls a little inside.
- New kinds of tap targets go into both lists (`src/styles.css`, `src/lib/no-long-press-menu.ts`).
- Checked in Chrome with emulated safe areas; the devices (iPhone with notch, Samsung) need a check there.
