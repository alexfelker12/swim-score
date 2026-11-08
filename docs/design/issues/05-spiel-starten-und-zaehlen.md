# #5 Spiel starten und zählen: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i05-start-spiel.png`](../screens/i05-start-spiel.png) | [`i05-start-spiel`](../source/i05-start-spiel.dc.html) | Spiel starten, 6 Spieler |
| [`i05-start-zu-wenig.png`](../screens/i05-start-zu-wenig.png) | [`i05-start-spiel`](../source/i05-start-spiel.dc.html) | unter 2 Spielern |
| [`i05-start-zu-viele.png`](../screens/i05-start-zu-viele.png) | [`i05-start-spiel`](../source/i05-start-spiel.dc.html) | über 9 Spielern |
| [`i05-runde-1.png`](../screens/i05-runde-1.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Runde 1 |
| [`i05-ben-verliert.png`](../screens/i05-ben-verliert.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | nach einem Verlust |
| [`i05-bombe-waehlen.png`](../screens/i05-bombe-waehlen.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Bombe: Werfer wählen |
| [`i05-bombe-ohne-konflikt.png`](../screens/i05-bombe-ohne-konflikt.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Bombe ohne Konflikt erfasst |
| [`i05-bombe-konflikt.png`](../screens/i05-bombe-konflikt.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Bombe mit Konflikt: Schwimmer wählen |
| [`i05-schwimmer.png`](../screens/i05-schwimmer.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Dario schwimmt, Ben ausgeschieden |
| [`i05-ein-schwimmer.png`](../screens/i05-ein-schwimmer.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | zweiter „Schwimmer“ scheidet direkt aus |
| [`i05-gewinner.png`](../screens/i05-gewinner.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Gewinner bestätigen |
| [`i05-spielende.png`](../screens/i05-spielende.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | Spielende |
| [`i05-gruppe-spiele.png`](../screens/i05-gruppe-spiele.png) | [`i05-gruppe-spiele`](../source/i05-gruppe-spiele.dc.html) | Gruppenseite, Tab „Spiele“ |
| [`i05-leben-balken.png`](../screens/i05-leben-balken.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | gewählte Lebensdarstellung: Balken |
| [`SpielScreen.png`](../screens/SpielScreen.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | klickbarer Prototyp (alle Zustände über `scenario`) |

## Verhalten und Texte

- **Spiel starten:**
  - Kopf „Neues Spiel“ mit Gruppenname. Überschrift „Am Tisch, im Uhrzeigersinn“ mit Zähler **„6/9“** rechts (bei Fehler in Koralle).
  - Teilnehmerzeilen (56 px) enthalten Griff zum Ziehen, Sitznummer, Name, „Gast“ und ✕ zum Entfernen. Der erste trägt das Badge **„Dealer“**.
  - Vorausgewählt sind Teilnehmer und Reihenfolge des letzten Spiels der Gruppe.
  - Abschnitt „Nicht dabei“: oben das Feld **„Neuer Gast, z. B. Lukas“** mit ＋ (legt den Gast an und setzt ihn an den Tisch), darunter die übrigen Spieler als gestrichelte Zeilen mit ＋.
  - Über „Spiel starten“ steht **nur eine Fehlerzeile**: „Mindestens 2 Spieler nötig.“ oder „Höchstens 9 Spieler. Nimm N Person(en) raus.“ Bei Fehler ist der Button deaktiviert (Deckkraft 0,4).
- **Spielansicht:**
  - Aufbau, Zeilenhöhe, Leben, Dealer-Badge, Schwimmer, Ausgeschiedene, Statuszeile und untere Leiste stehen in `decisions.md` › Spielansicht.
  - Prompt über den Zeilen: „Wer hat die Runde verloren?“. Vor der ersten Runde zeigt die Leiste „Noch keine Runde gezählt. Anna ist Dealer.“
- **Ereignistexte** (gleich in Leiste, Verlauf und Live-Ansicht):
  - „Ben verliert ein Leben“
  - „Anna wirft eine Bombe“
  - „Carla wirft eine Bombe, Dario schwimmt, Ben scheidet aus“
  - „Emil scheidet aus, es gab schon einen Schwimmer“
  - „Dario scheidet aus, Anna gewinnt“
- **Bombe:**
  - „Bombe“ schaltet in den Bomben-Modus: gelbe Ränder, Prompt „Wer hat die Bombe geworfen?“, der Button wird zu „Keine Bombe“.
  - Ein Tipp auf den Werfer erfasst die Bombe.
  - Bei Konflikt öffnet sich das Sheet „Wer wird Schwimmer?“ mit Erklärung und einer Option pro betroffenem Spieler („schwimmt“, blau), dazu „Bombe zurücknehmen“. Mit genau einem Betroffenen wird er automatisch Schwimmer, ohne Sheet.
- **Gewinner bestätigen:** Das letzte Ereignis wird erst gespeichert, wenn der Zähler bestätigt. Sheet: Pokal links neben „Anna gewinnt“, beides zentriert, Text „Dario scheidet aus. Damit endet das Spiel nach 10 Runden.“, Buttons „Spiel beenden“ und „Zurück, falsch getippt“.
- **Spielende:**
  - Überschrift „Spiel beendet“, Pokal + „Anna gewinnt“, „10 Runden, 1 Extra-Runde, 6 Teilnehmer“.
  - Tabelle: Platz, Name (+ „Schwimmer“), Leben (−n), Bomben.
  - Rückgängig-Hinweis mit Restzeit (#6), „Nochmal mit denselben Teilnehmern“ (#15), „Zur Gruppe“.
- **Tab „Spiele“:**
  - Oben eine hervorgehobene Karte für das laufende Spiel („Läuft, Runde 5 · heute, 21:40 · 6 Teilnehmer, Ben zählt · Dario schwimmt“).
  - Danach Monatsüberschriften und Einträge „Carla gewinnt · Do., 29. Okt. · 7 Teilnehmer, Schwimmer Ben“. Abgebrochene: „Abgebrochen · 5 Teilnehmer, zählt nicht“.
  - Unten fest der Button „Neues Spiel“.
- **Prototyp:** `SpielScreen.dc.html` enthält ein vollständiges Event-Replay als Referenz für die Oberfläche. Maßgeblich für die Regeln ist #2.

## Abweichungen vom Ticket

- Neuer Gast direkt beim Spielstart (siehe #4: jeder Spieler mit Konto darf Gäste anlegen).
- Die Oberfläche sagt „Dealer“ statt „Geber“.
- Schwimmer-Regel präzisiert: höchstens einer pro Spiel, auch nachdem er ausgeschieden ist (`i05-ein-schwimmer`).
