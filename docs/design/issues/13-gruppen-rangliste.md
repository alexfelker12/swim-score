# #13 Gruppen-Rangliste: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i13-rangliste.png`](../screens/i13-rangliste.png) | [`i13-rangliste`](../source/i13-rangliste.dc.html) | Rangliste: Siege, Gesamt |
| [`i13-kennzahl.png`](../screens/i13-kennzahl.png) | [`i13-rangliste`](../source/i13-rangliste.dc.html) | Sheet „Kennzahl“ |
| [`i13-zeitraum.png`](../screens/i13-zeitraum.png) | [`i13-rangliste`](../source/i13-rangliste.dc.html) | Sheet „Zeitraum“ mit eigenem Zeitraum |
| [`i13-rangliste-winrate.png`](../screens/i13-rangliste-winrate.png) | [`i13-rangliste`](../source/i13-rangliste.dc.html) | Winrate mit Mindestanzahl |
| [`hell-rangliste.png`](../screens/hell-rangliste.png) | [`i13-rangliste`](../source/i13-rangliste.dc.html) | helle Variante |

## Verhalten und Texte

- **Kennzahl und Zeitraum über der Liste**, zwei Auswahlfelder in einer Zeile (44 px):
  - Links die Kennzahl mit Icon und Pfeil, Rand und Text in Primärfarbe, Fläche `primary-muted`.
  - Rechts der Zeitraum mit Kalender-Icon, neutral.
  - Darunter in gedämpfter Farbe die Kurzbeschreibung der Kennzahl („Meiste Siege“, „Siege pro Spiel, ab 5 Spielen“).
- **Sheet „Kennzahl“:** eine Zeile pro Kennzahl mit Icon-Kachel, Name, Kurzbeschreibung und Häkchen. Ein Tipp wählt und schließt.
  - Siege: „Meiste Siege“
  - Winrate: „Siege pro Spiel, ab 5 Spielen“
  - Teilnahmen: „Meiste Spiele“
  - Bomben pro Spiel: „Ab 5 Spielen“
  - Schwimmer-Quote: „Wie oft geschwommen, ab 5 Spielen“
  - Unbreakable: „Siege als Schwimmer“
  - Untouchable: „Siege ohne verlorenes Leben“
- **Sheet „Zeitraum“:**
  - Radio-Liste: „Gesamt · Alle Spiele seit März 2024“, „2026 · Dieses Jahr“, frühere Jahre (nur solche mit Spielen), „Eigener Zeitraum · Von und bis selbst wählen“.
  - Beim eigenen Zeitraum zwei native Datumsfelder „Von“ und „Bis“.
  - Buttons „Abbrechen“ und „Übernehmen“. Der Button zeigt danach z. B. „1. März bis 30. Juni 2026“.
- **Liste:**
  - Platz, Name (+ „Gast“), Wert rechts mit Unterzeile („aus 71 Spielen“ bzw. „14 von 64“).
  - Gleiche Werte teilen sich den Platz (zweimal „10“). Platz 1 steht in Primärfarbe.
  - Zeilen mit Konto öffnen das Spielerprofil (#14).
- **Mindestanzahl:** Spieler unter 5 Spielen stehen bei Quoten-Kennzahlen in einem Abschnitt „Noch nicht gewertet, unter 5 Spielen“ mit „4 von 5 Spielen“.
- Ehemalige Spieler fehlen, Gäste zählen mit.

## Abweichungen vom Ticket

- **„Eigener Zeitraum“ ist neu** (Ticket: nur Gesamt oder Kalenderjahr). Die Statistik-Abfragen brauchen deshalb `from`/`to` statt nur `year`. Spec #1 (US 73) mitziehen.
- Jahre in der Auswahl: nur Jahre, in denen die Gruppe Spiele hat.
