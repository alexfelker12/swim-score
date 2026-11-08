# #12 Gruppenverwaltung und ehemalige Spieler: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i12-verwaltung.png`](../screens/i12-verwaltung.png) | [`i12-verwaltung`](../source/i12-verwaltung.dc.html) | Gruppe verwalten (Verwalter) |
| [`i12-spieler-entfernen.png`](../screens/i12-spieler-entfernen.png) | [`i12-verwaltung`](../source/i12-verwaltung.dc.html) | Spieler entfernen bestätigen (`dialog="entfernen"`) |
| [`i12-gast-verknuepfen.png`](../screens/i12-gast-verknuepfen.png) | [`i12-verwaltung`](../source/i12-verwaltung.dc.html) | Gast zusammenführen (#11) |
| [`i12-gruppe-mitglied.png`](../screens/i12-gruppe-mitglied.png) | [`i12-verwaltung`](../source/i12-verwaltung.dc.html) | „Gruppe“ ohne Verwalter-Rolle: austreten |
| [`i03-profil.png`](../screens/i03-profil.png) | [`i03-profil`](../source/i03-profil.dc.html) | Konto löschen im Profil |

## Verhalten und Texte

- **Gruppe verwalten** (Einstellungs-Icon im Gruppenkopf):
  - „Name“ mit „Speichern“ zum Umbenennen.
  - Abschnitt „Spieler“: Zeilen mit Name und Zusatz („du, Verwalter“, „seit heute dabei“, „Gast“, „Gast, von Ben angelegt“).
    - Rechts das Icon `link` (nur Gäste, Zusammenführen #11) und `user-minus` (Entfernen, Koralle, alle außer man selbst).
  - Hinweis „Entfernte Spieler bleiben in alten Spielen sichtbar, tauchen aber nicht mehr in der Spielerauswahl und der Rangliste auf.“
- **Entfernen** fragt in einem Sheet nach: „Ben entfernen?“ mit „Ben wird ehemaliger Spieler. Alte Spiele bleiben unverändert, in Spielerauswahl und Rangliste taucht Ben nicht mehr auf.“ Buttons „Entfernen“ (Koralle, gefüllt) und „Abbrechen“.
- **Verwalter:** Abschnitt mit „Du verwaltest diese Gruppe.“ und „Verwalterrolle übergeben ›“ (Auswahl unter Spielern mit Konto).
- **Ehemalige Spieler:** Liste mit Grund („ausgetreten im September“, „Konto gelöscht“ bei „Ehemaliger Spieler 1“).
- **Gruppe verlassen:** Für den Verwalter gesperrt mit dem Hinweis „Als Verwalter übergibst du die Rolle zuerst an einen Spieler mit Konto.“
- **Ohne Verwalter-Rolle („Gruppe“):**
  - Name nur lesbar, Verwalter mit Erklärung („… Gäste kann jeder anlegen, auch direkt beim Spielstart.“), ehemalige Spieler.
  - „Gruppe verlassen“ mit „Deine bisherigen Spiele bleiben. In der Gruppe stehst du danach als ehemaliger Spieler. Zurück kommst du nur über eine neue Einladung.“
- **Konto löschen** (Profil › Details): Text „Löscht Name, Bild, E-Mail und Zugangsdaten. In deinen Gruppen stehst du danach als ‚Ehemaliger Spieler‘ in den alten Spielen, die Ergebnisse der anderen bleiben gleich.“ Vorschlag (nicht entworfen): davor eine Bestätigung wie bei „Ben entfernen?“.

## Abweichungen vom Ticket

- Siehe #4: Gäste legen alle Spieler mit Konto an. Die Verwaltung zeigt deshalb, wer einen Gast angelegt hat.
