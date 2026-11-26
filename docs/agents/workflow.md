# Workflow: Tickets bearbeiten

Ein Ticket (GitHub Issue mit `ready-for-agent`) ist genau ein Branch und ein Pull Request. Nur wenn der Mensch es ausdrücklich so festlegt, läuft eine zusammengehörige Serie (z. B. #58–#62) auf einem gemeinsamen Branch mit einem PR. Die Spec ist #1; die Tickets verweisen darauf und tragen ihre Abhängigkeiten als GitHub-„blocked by“.

## Ablauf pro Ticket

1. **Ticket wählen.** Nur Tickets, deren Blocker alle in `master` gemergt sind. Tickets ohne offene Blocker dürfen parallel laufen.
2. **Branch anlegen** von aktuellem `master`, mit Issue-Nummer im Namen, z. B. `5-spiel-starten-und-zaehlen`. Das macht der Mensch; der Agent arbeitet auf dem Branch, der ausgecheckt ist.
3. **Umsetzen** in einer frischen Sitzung pro Ticket: `/implement #<n>`. Für Spiellogik und Server-Befehle bevorzugt `/tdd`. Bei hartnäckigen Fehlern `/diagnosing-bugs`.
4. **Prüfen:**
   - Typecheck und Lint laufend, einzelne Testdateien laufend, die volle Testsuite einmal am Ende.
   - Oberfläche im Browser bei 320 und 390 px Breite.
   - `/code-review` seit `master`, beide Achsen parallel. Funde beheben; was bewusst vom Ticket abweicht, dem Menschen zur Entscheidung nennen.
   - Akzeptanzkriterien im Issue abhaken.
5. **Übergeben:** Der Agent nennt, welche Dateien geändert sind, und gibt mit:
   - **Commit-Titel** zum Kopieren, englisch im Stil der bisherigen Commits (`feat: …`, `fix: …`, `style: …`, `ci: …`, klein geschrieben, ohne Punkt). Bei Nachbesserungen vor dem PR jeweils wieder einen Titel.
   - **PR-Text** als Markdown zum Kopieren, deutsch im Stil der bisherigen PRs (Vorbild #57 und #65): `## Änderungen` mit fett gesetzten Stichpunkten und `Closes #<n>`, bei Bedarf „Bewusste Grenzen“, dann `## Geprüft` (Typecheck/Lint, Testzahl, was im Browser geprüft wurde, was noch nicht geprüft ist). `/pr` gibt es nicht überall; dann direkt danach schreiben.
6. **Committen, pushen, PR**: macht der Mensch. `Closes #<n>` schließt das Issue beim Merge und macht blockierte Tickets frei.
7. **Mergen**, wenn Tests, Typecheck und die CI (Migrationen) grün sind. Neue Migrationen wendet die CI beim Merge auf `master` an (README › Deployment). Danach wieder bei Schritt 1 mit frischem `master`.

## Regeln für Agents

- **Nicht committen, nicht pushen, keine Branches auf dem Remote anlegen.** Das macht der Mensch selbst. Issues lesen und kommentieren ist erlaubt.
- Vor dem Bauen `CONTEXT.md` und `docs/adr/` lesen (siehe `docs/agents/domain.md`) und deren Begriffe verwenden.
- Ein neuer Fachbegriff oder eine neue Grundsatzentscheidung gehört in `CONTEXT.md` bzw. ein neues ADR, im selben PR wie der Code.
- Weicht die Umsetzung vom Ticket ab, zuerst das Issue anpassen (oder nachfragen), dann bauen.
- Nur das Ticket umsetzen. Selbst gefundene Folgearbeit als Kommentar im Issue oder als neues Issue notieren, nicht nebenbei miterledigen.
- Wünscht der Mensch während eines Tickets eine kleine Ergänzung, wird dafür kein neues Ticket angelegt: Titel und Text des laufenden Issues ergänzen (eigener Punkt, eigenes Akzeptanzkriterium, abgehakt) und im selben Branch umsetzen.
- Keine Screenshots, Bilder oder sonstigen Arbeitsdateien an den Menschen schicken oder im Repo liegen lassen. Screenshots nur selbst ansehen; Übergaben ins Repo gehen über einen ignorierten Ordner und werden danach geleert.
- Migrationen nur hinzufügend schreiben (Spalten oder Tabellen hinzufügen, nicht umbenennen oder löschen); Vercel baut parallel zur CI, die sie anwendet.
- Server-Funktionen so ändern, dass eine ältere App-Version weiterläuft: Die installierte App nutzt ihren Code, bis jemand „Aktualisieren“ tippt (ADR 0011).
- Tests nur über die zwei Schnittstellen der Spec: die reine Spiellogik und die Server-Anwendungsschicht gegen echte Postgres-Datenbank.

## Wenn es nicht passt

- **Ticket zu groß für eine Sitzung:** mit `/to-tickets` teilen, Abhängigkeiten anpassen.
- **Sitzung wird zu lang:** mit `/handoff` an eine frische Sitzung übergeben.

## Oberfläche

- UI kommt aus den shadcn/ui-Komponenten auf Base UI in `src/components/ui` (ADR 0009). Vor dem Bauen nachsehen, welche Komponente passt (`docs/design/README.md` › Bausteine, shadcn-MCP oder `pnpm dlx shadcn@latest add <name>`). Keine eigenen Sheets, Dialoge, Tabs, Felder oder rohen `<button>`.
- Looks gehören als Variante oder Größe in die Komponente. An der Aufrufstelle nur Layout-Klassen (Abstand, Breite, Platzierung).
- Datum und Auswahl nativ: `DateInput`, `NativeSelect`.
- Mehrteiliges als Compound Component bauen, nicht inline zusammensetzen.
- Aktionen in Zeilen und Feldern so kompakt wie möglich: Icon-Button mit `aria-label`, wo es ein bekanntes Icon gibt (z. B. kopieren), sonst Text.
