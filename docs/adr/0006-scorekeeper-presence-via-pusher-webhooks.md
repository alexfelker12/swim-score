# Scorekeeper presence from Pusher's webhooks

Takeover (ADR 0003) needs the server to know whether the Scorekeeper's device is connected and since when. Every Participant with an account who has the Game open joins its Pusher presence channel (`presence-game-<id>`), authorised by the server as their account (`/api/pusher/auth`). Pusher reports members joining and the last device of an account leaving to `/api/pusher/webhook`; the server verifies the signature and stores per Participant whether they are connected and Pusher's time of that report. When it concerns the Scorekeeper, "presence" is sent on the Game's public channel, and devices load the Game again: the version stays, so the Scorekeeper's steps on their way are not refused.

## Considered Options

- **Heartbeats from the Scorekeeper's device to the server**: no webhook to set up, works locally; rejected because Pusher already knows the connection, and a heartbeat every few seconds costs requests and battery for the same answer.

## Consequences

- Reports are ordered by Pusher's clock only; an older report than the one stored is ignored (webhooks can arrive out of order).
- Recording a step or taking over sets the Participant connected without touching that time, so a lost "joined" webhook cannot keep a Scorekeeper offline who is plainly counting, and a later "left" still counts.
- While nothing is known (no Pusher, no webhook configured, never opened), the Scorekeeper counts as connected: takeover is immediate.
- The webhook needs a public URL, so presence works only where Pusher can reach the app (not in local development).
