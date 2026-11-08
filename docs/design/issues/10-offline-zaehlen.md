# #10 Offline zählen: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i10-offline-zaehlen.png`](../screens/i10-offline-zaehlen.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Zähler offline, 3 Runden nicht gesendet |
| [`i09-abgeloest.png`](../screens/i09-abgeloest.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Warteschlange abgelehnt (nach Übernahme) |

## Verhalten und Texte

- **Statuszeile offline:** invertiert (Fläche in Textfarbe, Text in Hintergrundfarbe) mit `cloud-off`-Icon und „Offline, 3 Runden nicht gesendet“. Sie ersetzt „Du zählst · alle sehen live mit“.
- Zählen, Bombe und Rückgängig funktionieren unverändert. Rückgängig wirkt auf nicht gesendete Ereignisse lokal.
- Vorschlag (nicht entworfen): Ist alles nachgeschickt, zeigt die Statuszeile wieder den Normalzustand, ohne eigenen Erfolgs-Hinweis.
- **Ablehnung:** Sheet wie bei #9 „Abgelöster Zähler“, verständlich und ohne Fehlercodes. Vorschlag für andere Ablehnungen: dasselbe Muster (Icon links neben der Überschrift, Erklärung, „Verstanden“).
