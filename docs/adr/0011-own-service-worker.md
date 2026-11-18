# A small own service worker that keeps only the app's files

The installed app must start without a connection (#51), and later reopen a running Game offline (#53, ADR 0003, ADR 0007). That needs a service worker.

We write it ourselves (`src/service-worker/sw.ts`, about 70 lines) instead of using Workbox through `vite-plugin-pwa`. TanStack Start allows only one entry in the client build, and a Workbox setup would have to be bent around that and around Nitro's output for Vercel, for a job that is small: keep a known list of files and answer from it. A Vite plugin (`src/service-worker/vite-plugin.ts`, production builds only) compiles the worker from TypeScript, fills in the list of this build's files and a version, and writes `/sw.js` next to the client files. The worker imports nothing; it has its own `tsconfig.sw.json`, because the worker types and the DOM types can't be in one TypeScript program.

## Cache rules

- **Kept on the device:** every built file of the client (JS, CSS, fonts as woff2), plus the manifest, icons, favicons and `offline.html`. Fetched once when a version installs, answered from the device afterwards. Built files carry a hash in their name; public files go into the version by content, so a changed public file also makes a new version.
- **Pages** (navigations) always go to the server. Only when it can't be reached, or hasn't answered after 10 seconds (poor reception makes requests hang instead of fail), does the worker answer with `offline.html`, a page that stands on its own without the app's scripts (colours after the device setting, "Erneut versuchen", reloads when the connection is back).
- **Never kept:** server functions, `/api/…` (sign-in, avatars, Pusher webhooks), anything from other origins. They go to the network as if there were no worker. So nothing of one account stays in the worker's cache for the next.
- One cache per version (`swim-score-<version>`); activating a version deletes the others, unless another page of the app is still open: it runs the old version and may still load its files (answered from any version's cache), so they are deleted at a later update.
- Installing fetches past the browser's HTTP cache (`cache: "reload"`), so public files come fresh.

## Updates

A new version installs in the background but does not take over on its own (no `skipWaiting` on install). The app shows "Neue Version verfügbar" with "Aktualisieren" and "Später"; "Aktualisieren" activates it and reloads that page. The hint is hidden while steps of a Game wait to be sent (ADR 0007) and without a connection, so the app never reloads in the middle of counting. The app looks for a new version whenever it comes back to the front.

## Pages without a connection inside the app

A page loaded inside the running app calls server functions, which fail with a `TypeError` when the server can't be reached. The router's default error page shows "Keine Verbindung" with "Erneut versuchen" for that, and the usual error otherwise.

## Considered Options

- **`vite-plugin-pwa` / Workbox:** rejected for now, see above. Worth another look if the caching rules grow beyond a fixed list.
- **Keeping pages (HTML) in the cache:** rejected, a rendered page holds the signed-in account's data. The Game page opens offline from the app shell instead (ADR 0012).

## Consequences

- In development there is no service worker (`import.meta.env.PROD`, plugin only for `vite build`); one left from a production build on the same address is unregistered.
- `offline.html` repeats the page and text colours of `src/styles.css` (like `src/lib/pwa.ts`, ADR 0010) and follows the device setting, not the account's look.
- Pages without a connection get the app shell when there is one (ADR 0012), otherwise `offline.html`.
