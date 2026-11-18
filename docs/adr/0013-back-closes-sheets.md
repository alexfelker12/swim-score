# "Zurück" closes the topmost sheet, through history entries the router doesn't see

In the installed app (#49) "Zurück" is the Android back button and gesture and, on iOS, the swipe from the left edge. With a Drawer or Dialog open it should close that sheet and not leave the page (#54), as in an app. The iOS swipe goes back in the browser history and nothing else, and Safari has no `CloseWatcher`; so every open sheet gets an entry of its own in the history (same URL), and going back from it closes the sheet.

TanStack Router treats every change of the history as a navigation: it replaces `history.pushState` with a version that tells the router, and its `popstate` listener loads the location again, including the root route's `beforeLoad`, which asks the server for the Viewer. So the sheets' entries are kept from the router: `src/lib/close-on-back.ts` keeps the browser's own `pushState` and adds its `popstate` listener before the router exists (`listenBeforeRouter()`, called first in `getRouter`), and stops the events that belong to sheets. `Drawer` and `Dialog` in `src/components/ui` use it through `useClosedByBack`, so no page needs to do anything.

## Rules

- **Open:** a sheet pushes its entry, marked with an id of its own for each opening (an entry left from an earlier opening never counts). Sheets open in a stack; "Zurück" closes only the topmost.
- **"Zurück":** puts the topmost sheet's entry back at once and closes the sheet through Base UI's `close()`, the same path as every other way of closing. A sheet whose action is still running (`useSheet`) stays open with its entry, so a second "Zurück" right away doesn't leave the page either; a sheet that closes removes the entry again.
- **Closed any other way** (button, backdrop, swipe down, Escape): its entry is removed with `history.back()`, whose `popstate` is kept from the router; a sheet opening right then waits with its entry until that step arrived.
- **A page opened from a sheet:** the sheet's entry stays below the new page. Going back over it later skips it ("Zurück" lands on the page the sheet was opened on).
- **Reloaded on a sheet's entry:** the mark is removed when the app starts. The entry stays as a step back on the same page.
- **Not on the sheet's page any more** (Chrome skips history entries pushed without a tap on the page, e.g. a sheet that opened by itself): the step is the router's, the sheet goes with its page.

## Considered Options

- **`CloseWatcher` only:** closes on Android and on desktop with Escape, but not with the iOS swipe (no support in Safari), which the user asked for.
- **Router navigations with history state** (`router.navigate` with `state`): every open and close would load the page again, with a server request for the Viewer each time and without a connection the fallback of ADR 0012.
- **A router blocker** (`useBlocker`) without own entries: on the first page of the installed app there is nothing to go back to, and "Zurück" would close the app instead of the sheet.

## Consequences

- `listenBeforeRouter()` must run before `createRouter`; later, the router would see the sheets' steps.
- "Vorwärts" onto the entry of a closed sheet steps back over it (a browser concern; the installed app has no forward button).
- Checked in Chrome with the browser's own back; the Android gesture and the iOS swipe need a check on a device.
