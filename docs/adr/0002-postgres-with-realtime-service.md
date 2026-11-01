# Postgres (Neon) with Pusher for realtime, not a realtime database

Live spectating and Scorekeeper handover need push updates, which pointed towards Convex. We chose Postgres plus a separate realtime channel instead: statistics are the app's main value and SQL (GROUP BY, window functions, ad-hoc queries, external tools) makes them far easier to build and explore, the legacy data already lives in Postgres, and there is no vendor lock-in on the data model.

## Considered Options

- **Convex**: live queries and transactional rule checks built in, first-class TanStack Start support; rejected because every statistic becomes hand-written TypeScript without SQL, and per-query read limits force precomputation early.

## Consequences

- The server must serialise Events per Game itself (e.g. a version number per Game) so two devices cannot record conflicting Events.
- Realtime is a notification layer only: Postgres stays the source of truth, clients refetch after a push.
- Concretely: Postgres on Neon accessed via Drizzle; Pusher channels per Game carry "Game changed" notifications.
