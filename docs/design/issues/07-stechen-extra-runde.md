# #7 Stechen und Extra-Runde mitschreiben: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i05-ben-verliert.png`](../screens/i05-ben-verliert.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | „Stechen“ erscheint nach einem Verlust in der Leiste |
| [`i07-stechen.png`](../screens/i07-stechen.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Sheet „Stechen angeben“ |
| [`i07-extra-runde.png`](../screens/i07-extra-runde.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Extra-Runde bei zwei Übrigen |
| [`i06-verlauf.png`](../screens/i06-verlauf.png) | [`i06-verlauf`](../source/i06-verlauf.dc.html) | Stechen und Extra-Runde im Verlauf |

## Verhalten und Texte

- **Stechen wird nachgetragen, nicht vorher abgefragt.** Der Verlust ist mit einem Tipp gespeichert. Danach zeigt die Leiste neben „Rückgängig“ den Button „Stechen“.
- **Sheet „Stechen angeben“:**
  - Text „Wer war mit Fiona im Stechen? Wähle mindestens eine Person.“
  - Der Verlierer steht fest oben mit „verloren“. Darunter die anderen lebenden Spieler zum An- und Abwählen. Ausgeschiedene erscheinen nicht.
  - Buttons „Abbrechen“ und „Speichern“. Speichern ist erst ab einer weiteren Person aktiv, das ergibt mindestens zwei Beteiligte.
- **Extra-Runde:**
  - Der Button „Extra-Runde“ erscheint in der Leiste nur bei genau zwei Übrigen.
  - Nach dem Erfassen zeigt der Kopf „Extra-Runde, Dealer bleibt Anna“. Die Rundennummer bleibt, die Leiste zeigt „Extra-Runde, Dealer bleibt Anna“.
- Beides ist rückgängig machbar und steht im Verlauf.

## Abweichungen vom Ticket

- Ticket: „Optionaler Schritt ‚Stechen‘ beim Verlust“. Das Design löst das als **nachträgliches** Ergänzen des letzten `lost`-Ereignisses. Serverseitig kann das z. B. das letzte Ereignis ersetzen oder ein `lost` mit `tiebreak` neu schreiben. Das Ticket entsprechend präzisieren.
