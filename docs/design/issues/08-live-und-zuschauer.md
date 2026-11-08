# #8 Live-Mitsehen und Zuschauer-Link: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i08-teilnehmer-live.png`](../screens/i08-teilnehmer-live.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Teilnehmer sieht live mit (9 Spieler) |
| [`i08-zuschauer-teilen.png`](../screens/i08-zuschauer-teilen.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Zuschauer-Link und QR-Code teilen |
| [`i08-zuschauer.png`](../screens/i08-zuschauer.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Zuschauer-Ansicht ohne Konto |
| [`i08-link-abgelaufen.png`](../screens/i08-link-abgelaufen.png) | [`i08-link-abgelaufen`](../source/i08-link-abgelaufen.dc.html) | Zuschauer-Link nach Spielende |

## Verhalten und Texte

- **Teilnehmer, die nicht zählen:**
  - Gleiche Spielansicht ohne Tippflächen, ohne Prompt und ohne Aktionen in der Leiste. Die Leiste zeigt nur das letzte Ereignis.
  - Statuszeile „Ben zählt“ mit „Übernehmen“ (#9). In der Zeile des Zählers steht das Badge „zählt“.
- **Zuschauer einladen** (Spielmenü → Sheet):
  - QR-Code und „Wer den Code scannt, sieht das Spiel live, auch ohne Konto. Der Link gilt nur, solange das Spiel läuft.“
  - Darunter der Link (`swimscore.app/z/<token>`) mit „Kopieren“, dann „Link teilen“ (Web Share) und „Fertig“.
- **Zuschauer-Ansicht:**
  - Read-only, Statuszeile „Du schaust zu, Ben zählt“. Kein Menü, keine Übernahme.
  - Vorschlag (nicht entworfen): Ist der Zähler offline, zeigt die Statuszeile das wie bei #9, nur ohne Übernehmen.
- **Link abgelaufen:** eigene Seite mit Logo. Icon links neben der Überschrift „Dieses Spiel ist vorbei“, Text „Zuschauer-Links gelten nur, solange ein Spiel läuft. Das Ergebnis sehen alle Spieler der Gruppe in der App.“, Button „Swim Score öffnen“.
