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

## Abweichungen in der Umsetzung

- **Adresse der Einladung:** `/invite/<token>` statt `/e/<token>`, weil URLs im Projekt englisch sind. Der Token hat 22 Zeichen (128 Bit), nicht 10 wie im Bild. Gruppen von vor diesem Ticket bekommen bei der Migration einen Token aus 32 Hex-Zeichen, bis der Verwalter den Link erneuert.
- **Gast direkt verknüpfen:** „Gruppe verwalten“ gibt es erst mit #12. Bis dahin sitzt das `link`-Icon in der Gastzeile des Tabs „Spieler“ (nur beim Verwalter) und öffnet dasselbe Sheet. #12 zieht es in die Verwaltung um.
- **Gast ohne Spiele:** Anfrage-Karte und Sheet nennen dann keine „0 Spiele“, sondern sagen, dass der Gast noch kein Spiel hat.
- **Gemeinsames Spiel:** Haben Gast und Konto schon im selben Spiel gesessen, lehnt die App das Zusammenführen mit einer Meldung ab (nicht entworfen).
- **Ein Spiel:** Anfrage-Karte und Sheet schreiben bei genau einem Spiel „das eine Spiel“ statt „die 1 Spiele“.
- **Verwalter verknüpft nicht mit sich selbst:** Das Sheet „mit Konto verknüpfen“ listet nur andere Spieler mit Konto, der Server lehnt den Verwalter als Ziel ab. Gibt es außer dem Verwalter noch kein Konto in der Gruppe, zeigt das Sheet stattdessen den Hinweis „Noch ist außer dir niemand mit Konto in der Gruppe. Sobald Emil über die Einladung beigetreten ist, kannst du hier verknüpfen.“
