# #9 Zähler übernehmen: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i08-teilnehmer-live.png`](../screens/i08-teilnehmer-live.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | „Übernehmen“ bei verbundenem Zähler |
| [`i09-uebernahme-gesperrt.png`](../screens/i09-uebernahme-gesperrt.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Zähler kurz offline: gesperrt mit Countdown |
| [`i09-uebernahme-warnung.png`](../screens/i09-uebernahme-warnung.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Übernahme mit Warnung |
| [`i09-abgeloest.png`](../screens/i09-abgeloest.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | abgelöster Zähler kommt zurück |
| [`i06-verlauf.png`](../screens/i06-verlauf.png) | [`i06-verlauf`](../source/i06-verlauf.dc.html) | Übernahme im Verlauf |

## Verhalten und Texte

- **Statuszeile (Teilnehmer mit Konto):**
  - „Ben zählt“ mit dem Button „Übernehmen“, sofort möglich.
  - Ist der Zähler getrennt: „Anna ist seit 0:40 offline“ mit dem deaktivierten Button „Übernehmen in 1:20“ (Countdown bis etwa 2 Minuten).
  - Danach „Anna ist seit 4 Min. offline“ mit aktivem „Übernehmen“.
- **Warn-Sheet:**
  - Icon links neben „Zählen übernehmen?“, Text „Anna ist seit 4 Minuten offline. Runden, die Anna in dieser Zeit gezählt und noch nicht gesendet hat, gehen verloren.“
  - Buttons „Trotzdem übernehmen“ und „Abbrechen“.
- **Nach der Übernahme:** Alle sehen sofort „Carla zählt“. Der Verlauf zeigt „Carla übernimmt das Zählen · Ben war offline“.
- **Abgelöster Zähler kommt zurück** (auch #10):
  - Sheet mit Icon links neben „Carla zählt jetzt“ und dem Text „Du warst offline, als Carla übernommen hat. Deine 2 nicht gesendeten Runden wurden verworfen. Gleicht den Stand am Tisch ab, angezeigt wird jetzt der gespeicherte Stand.“
  - Button „Verstanden“. Danach ist er normaler Teilnehmer.
- **Gäste ohne Konto** sehen kein „Übernehmen“.
