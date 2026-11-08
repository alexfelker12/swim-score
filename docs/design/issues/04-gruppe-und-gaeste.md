# #4 Gruppe anlegen und Gäste: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i04-gruppe-anlegen.png`](../screens/i04-gruppe-anlegen.png) | [`i04-gruppe-anlegen`](../source/i04-gruppe-anlegen.dc.html) | Gruppe anlegen |
| [`i04-spieler.png`](../screens/i04-spieler.png) | [`i04-spieler`](../source/i04-spieler.dc.html) | Gruppenseite, Tab „Spieler“ (Verwalter) |
| [`i04-spieler-mitglied.png`](../screens/i04-spieler-mitglied.png) | [`i04-spieler`](../source/i04-spieler.dc.html) | Tab „Spieler“ ohne Verwalter-Rolle (`rolle="spieler"`) |
| [`i15-start-leer.png`](../screens/i15-start-leer.png) | [`i15-start`](../source/i15-start.dc.html) | Startseite ohne Gruppe, Einstieg „Gruppe anlegen“ |

## Verhalten und Texte

- **Gruppe anlegen:**
  - Kopf mit ✕ und „Neue Gruppe“. Feld „Name der Gruppe“ mit Hinweis „Zum Beispiel wo oder wann ihr spielt.“
  - Kasten „So geht es weiter“ mit drei Punkten (du bist Verwalter, Gäste anlegen, per Link oder QR einladen).
  - Button „Gruppe anlegen“ führt zur Gruppenseite.
- **Gruppenseite (Rahmen für #5, #13 und dieses Ticket):**
  - Kopf mit Zurück zur Startseite, Gruppenname (20/700), „N Spieler“, Einladen-Icon `user-plus` (nur Verwalter, Ziel #11) und Einstellungs-Icon `sliders` (Verwalter: „Gruppe verwalten“ #12, sonst „Gruppe“).
  - Darunter Segmented Tabs „Spiele“, „Rangliste“, „Spieler“.
- **Tab „Spieler“:**
  - Oben ein Eingabefeld „Gast hinzufügen, z. B. Lena“ mit einem ＋-Button (52 × 52 px). Es ist **für alle Spieler mit Konto** sichtbar, nicht nur für den Verwalter.
  - Liste mit Avatar-Kreis (36 px, Initiale; bei Gästen gestrichelt und gedämpft), Name, „du“ beim eigenen Eintrag und den Badges „Verwalter“ (Primär) bzw. „Gast“ (gedämpft).
  - Keine E-Mail-Adressen.
  - Zeilen mit Konto öffnen das Spielerprofil (#14), Gäste sind nicht antippbar.
  - Unten der Link „2 ehemalige Spieler“ zur Verwaltung bzw. Gruppenansicht (#12).
- **Meine Gruppen** steht auf der Startseite (#15) als Karten mit Name und „N Spieler, zuletzt am …“ bzw. „Spiel läuft“.

## Abweichungen vom Ticket

- **Gäste anlegen dürfen alle Spieler mit Konto**, nicht nur der Verwalter. Ticket-Kriterium neu: „Jeder Spieler mit Konto legt Gäste an; gespeichert wird, wer den Gast angelegt hat.“
  - Grund: Wer am Tisch dabei ist, soll nicht vom Verwalter abhängen.
  - Der Verwalter sieht in der Verwaltung „Gast, von Ben angelegt“ und kann Gäste entfernen oder zusammenführen (#12, #11).
  - Fürs Datenmodell heißt das: Player bekommt `createdBy`.
  - Spec #1 (US 17) und `CONTEXT.md` (Group Admin) mitziehen.
