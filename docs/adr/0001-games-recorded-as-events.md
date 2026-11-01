# Games are recorded as Events, not state snapshots

The old app stored a full snapshot (every player's Lives, Swimmer, Dealer) per round and derived statistics by diffing snapshots. We record each Game as an ordered list of Events (who lost a Life, who threw a Bomb, who became Swimmer) and derive the state by replaying them through the rules engine with the Game's Rule Set. Comparing players across their games is the app's main value, and those statistics ask what happened rather than what the state was; Events also let the server validate every step against the rules and make undo and replay natural.

## Consequences

- Legacy snapshots are converted to Events once, by diffing consecutive snapshots, during the import from the old app.
- State is never stored as the source of truth; any cached state must be rebuildable from Events.
- New statistics can be added at any time and apply retroactively to all recorded Games, since they are computed from Events.
