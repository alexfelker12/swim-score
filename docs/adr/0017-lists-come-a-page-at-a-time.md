# Lists come a page at a time

Groups collect Games over the years, and a Group's Games, its Players and the start page's Groups all came in one answer, rendered at once. Lists now load a page at a time and the next page when the list's end comes near the screen (#59): 15 Games of a Group, 25 Players, 15 Groups on the start page.

## Rules

- **A page names the entry it ends with** (`src/server/paging.ts`): the client asks for `size` entries `after` a cursor and gets them with the cursor of the next page, null at the end. The cursor holds the values the list is ordered by, not a position, so an entry added in between (a Game started, a Guest added) neither shows twice nor pushes another out of the list. Each list checks the shape of its cursor; a cursor of another shape is `invalidPage`.
- **The orders:** Games in the database, running ones first, then by start (to the millisecond, imported Games carry microseconds), then by id. Players (by name, as `byName` compares) and Groups (last played, then joined) are ordered by the server, which loads them whole anyway, and paged after.
- **One way through every layer.** A list command takes `page` (`PageRequest`) and answers with `Page<T>`; a page size outside 1–50 or a cursor that isn't one is `invalidPage`. Its server function is `.validator(pagedInput<…>()).handler(pageOrNone(command))`: an empty page when the viewer may not see the list, a failure for `invalidPage`. In the browser `pagedQueryOptions` (page size 15 unless given) makes it an infinite query, loaders load it with `fetchInfiniteQuery`, the page reads it with `usePagedQuery`, and `ListEnd` at the list's end shows placeholders and loads the next page, or "Weitere laden" when that failed.
- **Invalidating a list loads every page shown again**, from the first; the keys stay below the Group's and the start page's, so the existing reloads (ADR 0004) reach them.
- **"Meine Gruppen" is kept on the device** like the start page (ADR 0012): without a connection the pages kept stand in.

## Consequences

- The Group (`getGroup`) still carries all its Players, for the header's count, Claims and "Gruppe verwalten"; only the Players tab lists them a page at a time.
- The start page (`getHome`) no longer carries the Groups; it shows the empty state when there is no Group for "Neues Spiel".
- A list ordered by the server (Players, Groups) still loads all of its rows per page from the database; fine for the sizes of a circle of friends. Since the Group carries its Players anyway, paging them saves rendering, not data.
- In those lists an entry can change its place between two pages (a Player renamed, a Group that just played) and then show twice or not at all until the list loads again; `usePagedQuery` drops the second one. A Game moves only when it ends and leaves the running ones at the top; that change reloads the list from its first page anyway (`gameChanged`).
