# The Scorekeeper can keep recording offline

Bars often have poor reception. The Scorekeeper's device queues Events locally while offline and sends them when the connection returns; the server validates each one on arrival as usual, and Spectators see the last synced state meanwhile. The server cannot tell a dead zone from a device that is gone for good, so takeover is blocked for a short grace period (about 2 minutes) after the Scorekeeper goes offline; after that another Participant can take over after an explicit warning that unsent Events will be lost.

## Consequences

- When a former Scorekeeper reconnects after a takeover, the server rejects their queued Events and their device shows why.
- Scorekeeper connectivity must be visible to the server (presence), not just inferred from the last Event.
