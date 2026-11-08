# #14 Spielerprofil und persönliche Statistik: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i14-profil.png`](../screens/i14-profil.png) | [`i14-profil`](../source/i14-profil.dc.html) | Eigenes Spielerprofil |
| [`i14-profil-mitspieler.png`](../screens/i14-profil-mitspieler.png) | [`i14-profil`](../source/i14-profil.dc.html) | Profil eines Mitspielers |
| [`i03-profil-statistik.png`](../screens/i03-profil-statistik.png) | [`i03-profil`](../source/i03-profil.dc.html) | Profil › Meine Statistik (eigenes Konto) |
| [`i13-zeitraum.png`](../screens/i13-zeitraum.png) | [`i13-rangliste`](../source/i13-rangliste.dc.html) | gleiches Zeitraum-Sheet wie in der Rangliste |

## Verhalten und Texte

- **Erreichbar** über das eigene Profil (Avatar auf der Startseite → Tab „Meine Statistik“), aus der Rangliste und aus der Spielerliste (#4).
- **Kopf:** Avatar und Name, Unterzeile „Spielt in 2 Gruppen“ (eigenes) bzw. „Spielt seit März 2024“ (Mitspieler).
- **„Über alle Gruppen“** mit Zeitraum-Button rechts (gleiches Sheet wie #13, inkl. „Eigener Zeitraum“). Darunter 7 Kacheln im 2er-Raster:
  - Teilnahmen
  - Siege
  - Winrate
  - Bomben pro Spiel
  - Schwimmer-Quote
  - Unbreakable
  - Untouchable
- **„Nach Gruppe“** (bei Mitspielern „In euren gemeinsamen Gruppen“):
  - Eine Karte pro Gruppe mit Spiele, Siege und Winrate. **Die ganze Karte ist ein Link** zur Rangliste dieser Gruppe, rechts oben steht „Rangliste ›“.
  - Bei Mitspielern darunter: „Hier stehen nur Gruppen, die ihr beide teilt. Die Werte oben zählen alle Spiele von Ben.“

## Abweichungen vom Ticket

- Der Zeitraum enthält „Eigener Zeitraum“, siehe #13.
- Die Gruppen-Karten verlinken zur Gruppen-Rangliste. Das geht immer, weil man nur Karten von Gruppen sieht, in denen man selbst Spieler ist.
