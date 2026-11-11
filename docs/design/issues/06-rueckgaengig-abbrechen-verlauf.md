# #6 Rückgängig, Abbrechen und Spielverlauf: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i05-ben-verliert.png`](../screens/i05-ben-verliert.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | „Rückgängig“ in der Leiste |
| [`i06-menue.png`](../screens/i06-menue.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Spielmenü (⋯) |
| [`i06-abbrechen.png`](../screens/i06-abbrechen.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Spiel abbrechen bestätigen |
| [`i06-verlauf.png`](../screens/i06-verlauf.png) | [`i06-verlauf`](../source/i06-verlauf.dc.html) | Spielverlauf Runde für Runde |
| [`i06-ausgeblendet.png`](../screens/i06-ausgeblendet.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | 9 Spieler, Ausgeschiedene ausgeblendet |
| [`i05-spielende.png`](../screens/i05-spielende.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Rückgängig nach Spielende mit Restzeit |

## Verhalten und Texte

- **Rückgängig:** Der Button steht in der Leiste neben dem letzten Ereignis. Jeder Tipp nimmt ein Ereignis zurück, danach zeigt die Leiste das vorherige. Ohne Ereignisse gibt es keinen Button.
- **Nach Spielende:** „Falsch gezählt? Der letzte Schritt lässt sich noch 9 Minuten zurücknehmen.“ mit „Rückgängig“. Nach Ablauf des Fensters verschwindet beides.
- **Rundenanzeige:** Der Kopf zeigt „Runde N“.
- **Spielmenü** (⋯ oben rechts, Bottom Sheet „Spiel“):
  - „Spielverlauf“
  - „Zuschauer einladen“ (#8)
  - „Ausgeschiedene ausblenden“ (Schalter)
  - „Spiel abbrechen“ (Koralle)
  - „Schließen“
- **Abbrechen:** Sheet „Spiel abbrechen?“ mit „Das Spiel bleibt in der Spielliste der Gruppe sichtbar, zählt aber in keine Statistik. Das lässt sich nicht zurücknehmen.“ Buttons: „Spiel abbrechen“ (Koralle, gefüllt) und „Weiterspielen“.
- **Ausgeblendet:** Ausgeschiedene Zeilen fallen weg, die übrigen werden höher. Über der Leiste steht „2 Ausgeschiedene ausgeblendet.“ mit „Anzeigen“.
- **Spielverlauf** (read-only):
  - Kopf mit Datum und Uhrzeit („Do., 5. November, 21:40 bis 22:20“), Gewinner-Zeile, Kurzinfo.
  - Pro Runde: Nummer, Ereignistext und Meta („Dealer Anna“, „Schwimmer per Wahl“, „es gab schon einen Schwimmer“, „Stechen mit Anna und Carla“).
  - Zählerwechsel als eigene Zeile ohne Nummer: „Carla übernimmt das Zählen · Ben war offline“ (#9).
  - Extra-Runde mit der Meta „Anna und Dario gleichauf“ (#7).

## Abweichungen in der Umsetzung

- **„Zuschauer einladen“** fehlt im Spielmenü, bis #8 den Zuschauer-Link bringt. Ebenso „alle sehen live mit“ in der Statuszeile.
- **„Stechen“** in der Leiste kommt mit #7. Der Verlauf zeigt Stechen und Extra-Runde aber schon, wenn sie als Ereignis vorliegen.
- **Spielverlauf erreichbar:** im laufenden Spiel über das Menü, bei beendeten und abgebrochenen Spielen über ein Verlauf-Icon (`history`) oben rechts im Kopf. Der Verlauf steht allen Spielern der Gruppe offen, auch während das Spiel läuft (Kopf „Läuft, Runde N“, Zeit „seit 21:40“). Ein abgebrochenes Spiel zeigt „Abgebrochen“ und „zählt in keine Statistik“.
- **Rückgängig nach Spielende** zeigt die Restzeit in ganzen Minuten, aufgerundet („noch 10 Minuten“ direkt nach dem Ende, „noch 1 Minute“ am Schluss). Das Fenster beginnt mit dem Spielende auf dem Server.
- **Ausgeschiedene ausblenden** gilt pro Gerät und wird im Browser gespeichert. Die Einzahl heißt „1 Ausgeschiedener ausgeblendet.“
- **Abbrechen** setzt wie das Spielende eine Endzeit, damit der Verlauf „21:40 bis 22:20“ zeigen kann.

