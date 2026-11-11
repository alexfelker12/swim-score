# Pusher for "Game changed", not Neon Realtime

ADR 0002 named Pusher but left open, until live spectating (#8) was built, whether Neon's own realtime would do instead. In November 2026 Neon Realtime is a public beta (since 15 October 2026) whose transport protocol is not yet stable, and it offers live SQL queries but no presence. Scorekeeper takeover (#9, ADR 0003) needs to know whether the Scorekeeper's device is connected, which Pusher's presence channels provide. So we keep Pusher: after every change of a Game (an Event recorded or undone, a Tiebreak added, the Game cancelled) the server sends "changed" with the Game's new version on that Game's channel, and every device showing an older version loads the Game again through the server.

## Considered Options

- **Neon Realtime**: a live query on the Game's version straight from Postgres, no second service; rejected for now because it is beta, and presence for #9 would still need something else.

## Consequences

- The channel is public and named after the Game's id (`game-<id>`). It carries nothing but the version number; the Game itself is only ever loaded through the server, which checks who may see it (a Player of the Group, or the Spectator link while the Game runs). Presence for #9 will need authorised channels.
- The notification is sent after the change is saved and can never make the command fail; a lost notification only means a device sees the change when it loads the Game next, or when its connection comes back.
- Without Pusher configured (local development), the app runs as before, just not live.
- `App` has a `notifier`; tests use a fake that records every notification.
