## Gruppe anlegen und Gäste

Closes #4

Gruppen mit Spielerliste und Gästen, nach dem abgenommenen Design (`docs/design/issues/04-gruppe-und-gaeste.md`). Die Abweichung aus dem Design-Kommentar ist umgesetzt: **Jeder Spieler mit Konto legt Gäste an**, gespeichert wird, wer den Gast angelegt hat.

### Datenbank

- **Schema** (`src/server/db/schema.ts`), Migration `drizzle/0002_groups.sql`:
  - `group`: Name und Verwalter (`admin_id`, ein Konto)
  - `player`: gehört zu einer Gruppe, mit Konto (`user_id`) oder als Gast mit eigenem Namen. Bei Gästen steht in `created_by_id`, wer sie angelegt hat, bei Spielern mit Konto ist das Feld leer. Ein Konto ist pro Gruppe höchstens einmal Spieler (Unique-Index).

### Server-Befehle (`src/server/groups.ts`)

- `createGroup`: Name 1–40 Zeichen. Der Ersteller wird erster Spieler und Verwalter.
- `getGroup`: Gruppe mit Spielerliste (Name, Bild, Gast, Verwalter, „du“, bei Gästen „angelegt von“), nach Namen sortiert. **Keine E-Mail-Adressen**: Aus der Konto-Tabelle werden nur Name und Bild geladen.
- `addGuest`: für jeden Spieler mit Konto. Name 1–30 Zeichen. Abgelehnt (`nameTaken`), wenn schon ein Spieler der Gruppe so heißt (Groß-/Kleinschreibung egal, Akzente zählen).
- `listMyGroups`: „Meine Gruppen“ mit Spielerzahl, zuletzt beigetretene zuerst.
- **Zugriff:** Wer nicht Spieler der Gruppe ist, bekommt `groupNotFound`, als gäbe es die Gruppe nicht. Ohne Sitzung lehnt jeder Befehl mit `notSignedIn` ab.
- `functions.ts`: `Outcome<T>` kann jetzt einen Wert zurückgeben (z. B. die ID der neuen Gruppe). Bestehende Aufrufer bleiben unverändert.

### Tests (`src/server/groups.test.ts`, 18 Tests)

Gegen PGlite mit den echten Migrationen: Ersteller als Verwalter, Gast durch einen Nicht-Verwalter samt „angelegt von“, Namensregeln, Sortierung, Zugriff durch Fremde (lesen und Gast anlegen), „Meine Gruppen“, alle Befehle ohne Sitzung.

`src/server/testing/groups.ts` › `joinGroup` fügt einen zweiten Spieler direkt in die Datenbank ein, weil der Beitritt per Einladung erst mit #11 kommt. Mit #11 durch den echten Befehl ersetzen.

### Oberfläche

- **`/groups/new`** „Neue Gruppe“: Feld, Kasten „So geht es weiter“, danach weiter zum Tab „Spieler“.
- **`/groups/$groupId`**: Kopf mit Name und „N Spieler“, Tabs „Spiele“, „Rangliste“, „Spieler“ (Search-Param `tab`). Spiele und Rangliste zeigen bis #5 und #13 einen Platzhalter.
  - Tab „Spieler“: Feld „Gast hinzufügen“ für alle, Liste mit Avatar (Gäste gestrichelt), „du“, Badges „Verwalter“ und „Gast“.
- **Startseite**: „Meine Gruppen“ als Karten mit „Gruppe anlegen“, ohne Gruppe der leere Zustand mit Button „Gruppe anlegen“.
- Neuer Baustein `src/components/badge.tsx`.

### Bewusst noch nicht drin

- Einladen-Icon und Einstellungs-Icon im Kopf, Link „N ehemalige Spieler“: Die Ziele kommen mit #11 und #12.
- Zeilen mit Konto öffnen noch kein Spielerprofil (#14).
- Karten unter „Meine Gruppen“ zeigen noch nicht „zuletzt am …“ bzw. „Spiel läuft“ (#5, #15).
- Gleiche Gastnamen werden nur in der Anwendung geprüft, nicht per Datenbank-Index. Zwei gleichzeitige Einträge desselben Namens sind theoretisch möglich.

### Doku

- `CONTEXT.md`: Guest (wer Gäste anlegt, Namensregel) und Group Admin angepasst.
- Issue #1 (US 17, Datenmodell Player, Berechtigungen) und #4 (Akzeptanzkriterium) angepasst.

### Geprüft

`pnpm test` (108 Tests), `pnpm typecheck`, `pnpm lint`, `pnpm check`. Im Browser bei 390 × 844 durchgespielt: Gruppe anlegen, Gäste anlegen inklusive abgelehntem Duplikat, Startseite mit Gruppe, Fremder bekommt 404.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01TuQE1Adqzn1TgsL6y8Erju
