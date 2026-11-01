# Workflow: Tickets bearbeiten

Ein Ticket (GitHub Issue mit `ready-for-agent`) ist genau ein Branch und ein Pull Request. Die Spec ist #1; die Tickets verweisen darauf und tragen ihre Abhängigkeiten als GitHub-„blocked by“.

## Ablauf pro Ticket

1. **Ticket wählen.** Nur Tickets, deren Blocker alle in `master` gemergt sind. Tickets ohne offene Blocker dürfen parallel laufen.
2. **Branch anlegen** von aktuellem `master`, mit Issue-Nummer im Namen, z. B. `5-spiel-starten-und-zaehlen`.
3. **Umsetzen** in einer frischen Sitzung pro Ticket: `/implement #<n>`. Für Spiellogik und Server-Befehle bevorzugt `/tdd`. Bei hartnäckigen Fehlern `/diagnosing-bugs`.
4. **Prüfen** mit `/code-review` seit `master`; Akzeptanzkriterien im Issue abhaken.
5. **Committen, pushen, PR**: macht der Mensch. Den PR-Text kann `/pr` schreiben; er enthält `Closes #<n>`, damit das Issue beim Merge schließt und blockierte Tickets frei werden.
6. **Mergen**, wenn Tests und Typecheck grün sind. Danach wieder bei Schritt 1 mit frischem `master`.

## Regeln für Agents

- **Nicht committen, nicht pushen, keine Branches auf dem Remote anlegen.** Das macht der Mensch selbst. Issues lesen und kommentieren ist erlaubt.
- Vor dem Bauen `CONTEXT.md` und `docs/adr/` lesen (siehe `docs/agents/domain.md`) und deren Begriffe verwenden.
- Ein neuer Fachbegriff oder eine neue Grundsatzentscheidung gehört in `CONTEXT.md` bzw. ein neues ADR, im selben PR wie der Code.
- Weicht die Umsetzung vom Ticket ab, zuerst das Issue anpassen (oder nachfragen), dann bauen.
- Nur das Ticket umsetzen. Gefundene Folgearbeit als Kommentar im Issue oder als neues Issue notieren, nicht nebenbei miterledigen.
- Tests nur über die zwei Schnittstellen der Spec: die reine Spiellogik und die Server-Anwendungsschicht gegen echte Postgres-Datenbank.

## Wenn es nicht passt

- **Ticket zu groß für eine Sitzung:** mit `/to-tickets` teilen, Abhängigkeiten anpassen.
- **Sitzung wird zu lang:** mit `/handoff` an eine frische Sitzung übergeben.
