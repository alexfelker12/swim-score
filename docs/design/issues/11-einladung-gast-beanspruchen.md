# #11 Einladung und Gast beanspruchen: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i11-einladen.png`](../screens/i11-einladen.png) | [`i11-einladen`](../source/i11-einladen.dc.html) | Einladung teilen (Verwalter) |
| [`i11-einladung-annehmen.png`](../screens/i11-einladung-annehmen.png) | [`i11-einladung-annehmen`](../source/i11-einladung-annehmen.dc.html) | Einladung öffnen, Gruppe hat Gäste |
| [`i11-einladung-ohne-gaeste.png`](../screens/i11-einladung-ohne-gaeste.png) | [`i11-einladung-annehmen`](../source/i11-einladung-annehmen.dc.html) | Einladung öffnen, ohne Gäste |
| [`i11-anfrage-bestaetigen.png`](../screens/i11-anfrage-bestaetigen.png) | [`i04-spieler`](../source/i04-spieler.dc.html) | Verwalter bestätigt Anfrage |
| [`i11-einladung-ungueltig.png`](../screens/i11-einladung-ungueltig.png) | [`i08-link-abgelaufen`](../source/i08-link-abgelaufen.dc.html) | Einladung erneuert / ungültig |
| [`i12-gast-verknuepfen.png`](../screens/i12-gast-verknuepfen.png) | [`i12-verwaltung`](../source/i12-verwaltung.dc.html) | Gast direkt mit Konto verknüpfen |

## Verhalten und Texte

- **Einladung teilen** (Einladen-Icon im Gruppenkopf, nur Verwalter):
  - Titel „In die Gruppe einladen“, Text „Am Tisch: Code scannen lassen. Sonst den Link schicken. Wer als Gast mitgespielt hat, kann sich darüber seinen Gast holen.“
  - QR-Code mit Gruppenname, Link (`swimscore.app/e/<token>`) mit „Kopieren“, „Link teilen“.
  - „Link erneuern“ mit dem Hinweis „Erneuern macht den alten Link und den alten Code ungültig.“
- **Einladung öffnen:**
  - Nicht angemeldet: erst Anmelden oder Registrieren, danach zurück hierher.
  - Schon Mitglied: direkt zur Gruppenseite.
  - Kopf „Einladung von Anna“, Gruppenkarte mit „11 Spieler, 142 Spiele“.
- **Mit offenen Gästen:**
  - „Wer bist du?“ als Radio-Liste mit „Ich bin neu hier · Als neuer Spieler beitreten“ und „Ich bin Emil · Gast, 37 Spiele“ usw.
  - Bei Gastwahl der Hinweis „Anna bestätigt das. Danach gehören dir die bisherigen Spiele von Emil. Bis dahin bist du schon dabei.“
  - Button „Anfrage senden und beitreten“: Man ist sofort Spieler, die Gast-Übernahme wartet auf Bestätigung.
- **Ohne Gäste:** Text zur Sichtbarkeit (Anzeigename und Bild ja, E-Mail nein) und „Beitreten“.
- **Anfrage beim Verwalter:**
  - Karte „Offene Anfrage“ oben im Tab „Spieler“ mit Primär-Rand: „emil_k sagt: ‚Ich bin Emil‘“.
  - Text „Wenn du bestätigst, gehören die 37 Spiele von Gast Emil ab jetzt diesem Konto. Prüf kurz am Tisch, ob es wirklich Emil ist.“
  - Buttons „Ablehnen“ und „Bestätigen“.
- **Direkt verknüpfen** (Verwaltung, `link`-Icon in der Gastzeile):
  - Sheet „Emil mit Konto verknüpfen“: „Wähle, wer Emil ist. Die 37 Spiele von Gast Emil werden mit diesem Spieler zusammengeführt, der Gast verschwindet aus der Liste. Das lässt sich nicht rückgängig machen.“
  - Liste der Spieler mit Konto, frisch Beigetretene mit „emil_k, 0 Spiele“. Buttons „Abbrechen“ und „Zusammenführen“.
- **Ungültige Einladung:** Icon links neben „Diese Einladung gilt nicht mehr“, Text „Der Verwalter der Gruppe hat den Einladungslink erneuert. Bitte ihn um den aktuellen Link oder QR-Code.“, Button „Zur Startseite“.
