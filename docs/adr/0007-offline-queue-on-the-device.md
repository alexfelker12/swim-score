# The Scorekeeper's offline queue lives on the device

ADR 0003 lets the Scorekeeper keep recording without a connection. The steps not yet taken by the server (Events, undo, Tiebreaks) wait in a queue per Game and account on the device, kept in `localStorage` so it survives a reload, and are applied through the rules engine on top of what the server has. They are sent one after another, each with the version the one before produced, through the same server commands as online; the server stays the only judge, and nothing new is needed there.

## Decisions

- **Refused means dropped:** when the server refuses a step (a takeover, the Game changed or ended), it and everything after it are dropped and the Game is loaded again; the Scorekeeper is told how many Rounds were lost. Steps after a refused one would be built on a state the server does not have.
- **Lost answers:** after a send that got no answer, the next attempt first reads the Game; if it is one version on with that Event last, the step arrived and is not sent again (otherwise it would be refused as a version conflict and drop everything).
- **Only a missing connection is "offline":** other errors are retried a few times, then treated as a refusal, so a step that can never succeed does not block the queue forever.
- **Undo of unsent steps** drops them on the device; only undoing what the server has is sent.
- **The end of a Game and cancelling need the server:** the ending Event waits in the queue and shows once taken; cancelling waits until the queue is sent and is refused without a connection.

## Consequences

- Without a service worker (PWA, later) a page cannot be reloaded while offline; the queue is sent when the Game is opened again with a connection.
- The queue is keyed by account, so another account on the same browser never sends someone else's steps.
- The queue logic is client-only; per `docs/agents/workflow.md` it is not unit-tested and was checked in the browser with a simulated dead zone.
