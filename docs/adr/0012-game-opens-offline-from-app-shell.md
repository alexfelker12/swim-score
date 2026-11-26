# A running Game opens offline from the app shell and data kept on the device

The Scorekeeper must be able to open a running Game and count on with no connection, also after the app was closed (#53, ADR 0003). Until now the queue (ADR 0007) survived a reload, but the page itself needed the server: it is rendered there, and the root route asks the server for the Viewer on every navigation (since #58 only when it doesn't know it yet, ADR 0016). The prototype in #52 settled how the page starts without it.

## Decision

- **App shell.** TanStack Start prerenders a shell without data at build time (`spa` in `vite.config.ts`, `/_shell.html`). The service worker keeps it with the app's files and answers a page with it when the server can't be reached (ADR 0011); `offline.html` only stands in where there is no shell. Online nothing changes: the server renders every page as before. The shell carries `viewer: null` from the build, but the browser runs the root route's `beforeLoad` again on start.
- **Viewer remembered on the device.** After every answer of `getViewer` the browser remembers the Viewer, also the one a server-rendered page brings along. When the server can't be reached the root route takes the remembered Viewer. When another account or none answers, the previous account's data leaves the device and the query cache (the queue of unsent steps stays, ADR 0007).
- **Data kept on the device, per account.** Queries marked with `meta.keptOnDevice` (in `src/lib/queries.ts`: the start page and each Game) are kept in `localStorage` under the account's id after every answer and when a server-rendered page brings them along, as JSON that keeps `Date`s. Running Games are pinned; of the rest the 12 most recent stay. When the app starts they fill the query cache with the time they were loaded, so they count as stale and are loaded again as soon as there is a connection. If storage is full the entry is removed rather than left behind with an older state. `src/lib/kept-on-device.ts`. The marker is plain data, because `meta` goes to the browser with the page the server rendered.
- **Kept data stands in.** The start page and Game queries answer with what the cache holds when the server can't be reached (`orKept`). The queue (ADR 0007) lays its steps over the kept Game as over a loaded one.
- **Queries never wait for a connection.** All queries run with `networkMode: "always"` and are repeated only once while the server can't be reached: TanStack Query would otherwise pause them while the browser reports itself offline, and a page would wait forever instead of showing what is kept or "Keine Verbindung".
- **"Server not reached" is told apart from mistakes.** `isUnreachable` accepts only the `TypeError`s of a failed fetch ("Failed to fetch", "Load failed", "NetworkError …"); other errors show the usual error page, not "Keine Verbindung". The queue (ADR 0007) uses the same test.
- **Signing out or deleting the account** removes the Viewer and everything kept for the account. Another account on the same device only ever sees its own data.

## Considered Options

- **Keeping rendered pages in the service worker** (network first): a page holds the data of the moment it was loaded, is tied to the files of one build, holds the account's data in the worker's cache, and isn't loaded at all when the Game is opened from the start page inside the app. Rejected.
- **The whole app without server rendering:** not needed; the shell is only used offline.
- **IndexedDB or TanStack Query's persister:** more than needed for a few KB per Game; `localStorage` matches the queue (ADR 0007).

## Consequences

- Without a connection only the start page and the Games opened before work. "Neues Spiel", Groups and leaderboards show "Keine Verbindung" (no new Games offline, ADR 0003).
- The start page shows the running Game as it was last loaded, without rounds counted offline since; the Game page shows them.
- The local Node server (`node .output/server/index.mjs`) doesn't serve `/_shell.html`: Nitro fixes its list of static files before the shell is prerendered. Vercel serves it from `.vercel/output/static`. Locally the worker falls back to `offline.html`; see README › "Offline testen".
- The prerender at build time runs the root route, so the build needs the same environment as the server (`DATABASE_URL`, `BETTER_AUTH_*`).
- The service worker installs without the shell when it can't be loaded (the local Node server); a version deployed that way only shows `offline.html` offline. Checked once per deploy on a preview (README).
- Signing out without a connection removes the kept data on the device, but the session on the server stays until it expires.
