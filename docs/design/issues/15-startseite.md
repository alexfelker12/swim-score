# #15 Startseite: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i15-start.png`](../screens/i15-start.png) | [`i15-start`](../source/i15-start.dc.html) | ein laufendes Spiel |
| [`i15-start-ohne-spiel.png`](../screens/i15-start-ohne-spiel.png) | [`i15-start`](../source/i15-start.dc.html) | kein laufendes Spiel |
| [`i15-start-mehrere.png`](../screens/i15-start-mehrere.png) | [`i15-start`](../source/i15-start.dc.html) | zwei laufende Spiele |
| [`i15-start-leer.png`](../screens/i15-start-leer.png) | [`i15-start`](../source/i15-start.dc.html) | noch keine Gruppe |
| [`i15-start-laden.png`](../screens/i15-start-laden.png) | [`i15-start`](../source/i15-start.dc.html) | lädt (Skeleton) |
| [`i05-spielende.png`](../screens/i05-spielende.png) | [`SpielScreen`](../source/SpielScreen.dc.html) | „Nochmal mit denselben Teilnehmern“ |
| [`hell-start.png`](../screens/hell-start.png) | [`i15-start`](../source/i15-start.dc.html) | helle Variante |

## Verhalten und Texte

- **Kopf:** Logo „Swim Score“ links, Avatar rechts (öffnet das Profil).
- **Ein laufendes Spiel:**
  - Karte mit Primär-Rand: „● Spiel läuft“, Gruppenname, „Runde 5, 6 Teilnehmer, du zählst“ und ein Kurzstand („Anna 2 · Carla 2 · Dario schwimmt · Emil 1 · Fiona 1“).
  - Button „Weiterzählen“. Zählt jemand anderes, steht dort „Mitsehen“ wie bei mehreren Spielen.
  - Darunter sekundär „＋ Neues Spiel in Donnerstagsrunde“.
- **Kein laufendes Spiel:** Haupt-Button „Neues Spiel in Donnerstagsrunde“, darunter „Dort habt ihr zuletzt gespielt, am Donnerstag“.
- **Mehrere laufende Spiele:** Abschnitt „Laufende Spiele“, neuestes zuerst, je mit „vor 2 Min.“. Der Button heißt „Weiterzählen“, wo ich zähle, sonst „Mitsehen“. Danach „Neues Spiel in <Gruppe>“.
- **Welche Gruppe:** die Gruppe meines zuletzt gestarteten oder gespielten Spiels. Ohne bisheriges Spiel die zuletzt angelegte oder beigetretene Gruppe.
- **Meine Gruppen:** Karten mit Name und „11 Spieler, Spiel läuft“ bzw. „5 Spieler, zuletzt am 12. Oktober“ mit ›. Unten „＋ Gruppe anlegen“ (gestrichelt).
- **Leer:** „Hallo Anna“, Erklärung zu Gruppe anlegen oder Einladungslink, Hinweis zum QR-Code am Tisch, Button „Gruppe anlegen“.
- **Laden:** Skeleton-Flächen in Kartenform.
- **Nach Spielende:** „Nochmal mit denselben Teilnehmern“ öffnet „Spiel starten“ mit denselben Teilnehmern und derselben Reihenfolge.

## Abweichungen vom Ticket

- Präzisiert: welche Gruppe „Neues Spiel“ nimmt, und wie die Startseite bei mehreren laufenden Spielen aussieht.
