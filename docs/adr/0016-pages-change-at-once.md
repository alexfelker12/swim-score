# Pages change at once and load inside

A tap on a link should move to the next page right away (#58), as in an app. Until now the router waited for a page's loaders (ADR 0004) and for the root route's `beforeLoad`, which asked the server for the Viewer on every page change, before it changed the page. Only the start page had a loading state, and the router swapped it in without a transition after a second and played the slide (ADR 0014) a second time when the data arrived.

## Rules

- **Opening a page doesn't wait for its data.** In the browser a loader only starts loading (`loadPageData` in `src/lib/page-data.ts`); the router changes the page at once with one transition, and the page shows its `pendingComponent` through Suspense until `useSuspenseQuery` has the data, which then fills the page without a second transition. Data already in the cache shows at once, without a loading state.
- **Staying on a page waits as before.** A tab, a period or loading the page again (`cause: "stay"`) keeps the page showing until the new data is there. On the server the loader always waits, so a page arrives rendered.
- **No pending state from the router** (`defaultPendingMs: Infinity`): it would swap to the loading state without a transition and hold the transition back until the data arrives.
- **Every page with data has a loading state** built from `PageLoading`, `PageLoadingHeader` and `PageLoadingContent` (`src/components/page-loading.tsx`) with `Skeleton`: the header as far as it needs no data, back in the history, placeholders in the page's layout.
- **Missing data shows `PageNotFound` in the page.** When a Group, Game or Player turns out not to exist only after the page changed, the page renders it itself; the router doesn't catch `notFound()` thrown while rendering. Loaders still throw `notFound()`, for the server.
- **"Neues Spiel" starts fresh.** A form starts from its data, so a stale or invalidated preselection is dropped before the page opens (`dropIfStale`); the page shows its loading state instead of starting from old data.
- **The Viewer of the last page change stands in** (`src/lib/viewer.ts`). In the browser the root route asks the server only when it doesn't know the Viewer yet; otherwise it asks alongside, and when the answer differs (signed out or renamed on another device) the router loads again with the new Viewer. Signing in and out, deleting the account and changes in the profile ask first (`reloadViewer`).

## Considered Options

- **Keeping the router's pending state** with a shorter `pendingMs`: the loading state appears without a transition, the slide plays when the data is there, the bug of #58.
- **A view transition when the loading state appears:** the router has no hook for it.
- **Asking the server for the Viewer on every page change:** a round trip before every page, also when nothing changed.

## Consequences

- Invite links and Spectator links (`/invite/$token`, `/z/$token`) still wait for their data: people open them from outside, where the server renders them.
- A change of the Viewer on another device shows one page change later.
- A page that changes to another page of the same route with other params (no such link today) would hold the transition until its data is there, since the router keeps the page's Suspense boundary; a link like that needs the page keyed by its params.
- A page whose data is stale shows it at once and updates in place when the fresh data arrives, instead of waiting for it (ADR 0004 waited); only "Neues Spiel" waits.
