# Design-Entscheidungen (final, 08.11.2026)

Alles, was beim Entwurf entschieden wurde, und was davon von der Spec (#1), den Tickets oder `CONTEXT.md` abweicht. Bei einem Widerspruch gilt diese Datei. Die Tickets bekommen die Abweichungen als Kommentar.

## Abweichungen von Spec und Tickets (vor dem Bauen beachten)

| Thema | Bisher | Jetzt | Betrifft |
|---|---|---|---|
| Gäste anlegen | „Verwalter legt Gäste an“ (US 17, #4) | **Jeder Spieler mit Konto** legt Gäste an: in der Spielerliste und direkt beim Spielstart. Die Verwaltung zeigt, wer den Gast angelegt hat („Gast, von Ben angelegt“). Entfernen und Zusammenführen bleiben beim Verwalter. | #1, #4, #5, #12, `CONTEXT.md` (Group Admin) |
| Zeitraum der Statistik | „Gesamt oder Kalenderjahr“ (US 73, #13) | Gesamt, Kalenderjahre **mit Spielen** und **„Eigener Zeitraum“** (Von/Bis, native Datumsauswahl). Gleich in Rangliste und Profil-Statistik. | #1, #13, #14 |
| Anzeigename des Gebers | `CONTEXT.md`: Dealer (Geber) | In der Oberfläche heißt er **„Dealer“**. Im Code bleibt `Dealer`. | `CONTEXT.md` |
| Stechen erfassen | „Optionaler Schritt beim Verlust“ (#7) | Der Verlust wird sofort mit einem Tipp gespeichert. Danach bietet die Leiste unten „Stechen“ an, um die Beteiligten **nachzutragen**. Der Normalfall kostet nie einen zweiten Tipp. | #7 (Event `lost` bekommt `tiebreak` nachträglich, z. B. als Ersetzen des letzten Ereignisses) |
| Schwimmer | „höchstens ein Schwimmer“ | Präzisiert: **höchstens ein Schwimmer pro Spiel, auch nachdem er ausgeschieden ist.** Wer nach dem ersten Schwimmer sein letztes Leben verliert, scheidet direkt aus. Eine Bombe mit Schwimmerwahl gibt es nur, solange noch niemand geschwommen ist. | #2, #5 |

## Darstellung

- **Look:** ruhig und klar, mobile only (Design bei 390 px, max. 500 px Breite). **Dunkel ist Standard**, Hell ist die Alternative. Umgeschaltet wird per Einstellung im Profil (siehe „Nachträglich entschieden“).
- **Farben:** Dunkel nutzt den Grund „Graphit“ mit Primär „Türkis“ (#5CC2D6), Hell den Grund „Kühl“ mit Primär „Petrol“ (#147A93). Alle Werte stehen in `tokens.css`.
  - Schwimmer: Blau (#5B8FF2 / #2456C9), dunkler als Primär.
  - Bombe: Gelb (#F3BA4E / #9A5B00).
  - Abbrechen und Löschen: Koralle (#F07A66 / #C23A28).
- **Schrift:** IBM Plex Sans, Ziffern tabellarisch (`font-variant-numeric: tabular-nums`).
  - Stufen: 36/700 Gewinner, 22/600 Sheet-Titel, 20/600 Kopf und Spielername, 17/600 Abschnitt, 16/400 Fließtext, 14/500 Badges und Buttons in Leisten, 13/400 Meta.
- **Icons:** Lucide (z. B. `lucide-react`), Strich 2 px. Keine Emojis.
- **App-Zeichen:** „Swim Score“ mit abgerundetem Quadrat in Primärfarbe und zwei Wellen. Das SVG steht in `source/Main.dc.html`.
- **Icon + Überschrift** in Warn-Sheets und Fehlerseiten: Das Icon steht links neben der Überschrift, alles linksbündig. Ausnahme sind Gewinner-Sheet und Spielende: Pokal links neben dem Namen, beides zentriert.
- **Tippflächen:** Spielerzeilen mindestens 52 px, Haupt-Buttons 52–56 px, Icon-Buttons 44 × 44 px.
- **Entscheidungen** (Schwimmer wählen, Gewinner bestätigen, Stechen, Übernahme, Abbrechen, Kennzahl, Zeitraum) sind **Bottom Sheets**, keine Dialoge in der Bildmitte. Ausnahme: Der Profilbild-Editor ist ein Vollbild-Dialog, weil der Ausschnitt Platz braucht (siehe „Nachträgliche Anpassungen am Design“).

## Spielansicht (#5–#10)

- Eine Zeile pro Teilnehmer in Sitzreihenfolge. **Tipp auf eine Zeile heißt: diese Person verliert die Runde.**
- **Zeilenhöhe passt sich an**, damit 9 Spieler ohne Scrollen passen. Die Höhe ist `floor((verfügbare Höhe − 6 × (n − 1)) / n)`, begrenzt auf 52–88 px, mit 6 px Abstand. Ab 70 px wird die Schrift größer.
- **Leben:** Balken mit 3 Segmenten (84 × 10 px, Radius 5). Verlorene Segmente bleiben als Umriss sichtbar (`--life-off`).
  - Herzen sind die Alternative. Striche, Punkte, Zahl und Kreis wurden verworfen.
  - Ein Schalter, mit dem jeder seine Darstellung selbst wählt, ist nur eine Überlegung und nicht entschieden. Er wird nicht gebaut.
- **Dealer:** Pill-Badge mit Karten-Icon, das aus der **unteren linken Ecke** der Zeile ragt (`left: -6px; bottom: -7px; height: 20px`, Ring in Hintergrundfarbe).
- **Schwimmer:** blaue Umrandung, Wellen-Icon und „schwimmt“ anstelle der Leben.
- **Ausgeschieden:** gestrichelter Rand, Deckkraft 0,5, „ausgeschieden“. Die Zeile bleibt an ihrem Platz.
- **Kopf:** Zurück, „Runde N“ mit Gruppenname darunter (bei Extra-Runde: „Extra-Runde, Dealer bleibt X“), Menü (⋯).
- **Statuszeile** unter dem Kopf, immer sichtbar:
  - „Du zählst · alle sehen live mit“
  - „Ben zählt“ mit „Übernehmen“
  - „Anna ist seit 0:40 offline“ mit „Übernehmen in 1:20“
  - „Offline, 3 Runden nicht gesendet“
  - „Du schaust zu, Ben zählt“
- **Leiste unten:**
  - Das letzte Ereignis („Runde N · Ben verliert ein Leben“) mit „Rückgängig“. Nach einem Verlust zusätzlich „Stechen“.
  - Darunter „Bombe“ (gelber Umriss). Bei genau zwei Übrigen zusätzlich „Extra-Runde“.
- **Bombe:** Nach „Bombe“ fragt der Prompt „Wer hat die Bombe geworfen?“. Alle Zeilen bekommen einen gelben Rand, der Button heißt „Keine Bombe“. Tipp auf den Werfer erfasst die Bombe.
  - Trifft sie mehrere Spieler mit dem letzten Leben und es gab noch keinen Schwimmer, öffnet sich das Sheet „Wer wird Schwimmer?“ mit „Bombe zurücknehmen“.
- **Gewinner bestätigen** vor dem letzten Ereignis: Sheet „Anna gewinnt“ mit „Spiel beenden“ und „Zurück, falsch getippt“.
- **Spielende:**
  - Tabelle mit Platz, verlorenen Leben (−n), Bomben und Schwimmer-Markierung.
  - „Rückgängig“ mit Restzeit („noch 9 Minuten“), „Nochmal mit denselben Teilnehmern“, „Zur Gruppe“.

## Startseite (#15)

- **Ein laufendes Spiel:** große Karte mit Kurzstand und „Weiterzählen“. Darunter „Neues Spiel in <Gruppe>“ (sekundär) und „Meine Gruppen“.
- **Kein laufendes Spiel:** „Neues Spiel in <Gruppe>“ ist der Haupt-Button, darunter der Grund („Dort habt ihr zuletzt gespielt, am Donnerstag“).
- **Mehrere laufende Spiele:** Abschnitt „Laufende Spiele“, neuestes oben. „Weiterzählen“, wo ich zähle, sonst „Mitsehen“.
- **Welche Gruppe bei „Neues Spiel“:** die Gruppe meines zuletzt gestarteten oder gespielten Spiels. Ohne bisheriges Spiel die zuletzt angelegte oder beigetretene Gruppe.
- **Leer** (keine Gruppe): Begrüßung mit Erklärung, „Gruppe anlegen“. **Laden:** Skeleton.
- Der Avatar oben rechts öffnet das Profil.

## Konto (#3, #16)

- **Registrieren:** Benutzername, E-Mail, Passwort und „Passwort bestätigen“. Alle Passwortfelder haben einen Sichtbarkeits-Schalter (eye / eye-off). Das Passwort braucht mindestens 8 Zeichen.
- **Benutzername = Anmeldename, fest.** Anzeigename = frei änderbar, sichtbar in Spielen und Ranglisten.
  - Umsetzung mit dem better-auth-Plugin `username`: `username` ist die normalisierte Kleinschreibung, `displayUsername` die Originalschreibung desselben Namens.
  - Der Anzeigename ist `user.name`. Der Benutzername wird mit `immutableUsername: true` unveränderbar.
- **Google-Button** nach den Sign-in-with-Google-Richtlinien:
  - Farbiges „G“ (20 px), Google Sans Medium 14/20.
  - Dunkel: Fläche #131314, Rand #8E918F, Text #E3E3E3. Hell: #FFFFFF / #747775 / #1F1F1F.
  - 12 px Innenabstand links, 10 px zwischen Logo und Text.
- **Passwort vergessen?** steht unter dem Passwortfeld der Anmeldung. Die Bestätigung verrät nicht, ob die Adresse existiert. Der Link gilt eine Stunde. „Neues Passwort“ erreicht man nur über den Link in der E-Mail.
- **Profil** hat zwei Tabs:
  - „Details“: Bild, Anzeigename, Benutzername nur lesbar, E-Mail, Abmelden, Konto löschen.
  - „Meine Statistik“.

## Gruppe (#4, #11, #12)

- **Gruppenseite:** Kopf mit Name und Spielerzahl, Einladen-Icon (nur Verwalter) und Einstellungs-Icon. Darunter Tabs „Spiele“, „Rangliste“, „Spieler“ als Segmented Control.
- **Spielliste:** oben das laufende Spiel. Danach Monatsgruppen mit „X gewinnt · Datum · N Teilnehmer, Schwimmer Y“. Abgebrochene Spiele heißen „Abgebrochen … zählt nicht“. Unten der Button „Neues Spiel“.
- **Spielerliste:**
  - Gäste haben einen gestrichelten Avatar und ein „Gast“-Badge. Der Verwalter hat ein „Verwalter“-Badge, man selbst „du“.
  - Zeilen mit Konto öffnen das Spielerprofil, Gäste sind nicht antippbar.
  - Unten der Link „N ehemalige Spieler“.
- **Rechte:**
  - Einladen (Link/QR), Anfragen bestätigen, Spieler entfernen, Gäste zusammenführen, umbenennen und Verwalter übergeben darf nur der Verwalter.
  - Gäste anlegen dürfen alle Spieler mit Konto.
- **Verwaltung:** pro Spieler Icon-Buttons in der Zeile:
  - `user-minus` entfernt den Spieler (mit Bestätigung).
  - `link` gibt es nur bei Gästen: Er führt den Gast mit einem beigetretenen Konto zusammen (Sheet „Emil mit Konto verknüpfen“ → „Zusammenführen“, nicht umkehrbar).
- **Ohne Verwalter-Rolle:** Das Einstellungs-Icon öffnet „Gruppe“. Dort stehen Name (nur lesbar), Verwalter, ehemalige Spieler und „Gruppe verlassen“.
- **Einladung öffnen:**
  - Nicht angemeldet: erst Anmelden oder Registrieren, dann zurück zur Einladung.
  - Schon Mitglied: direkt zur Gruppe.
  - Mit offenen Gästen: „Wer bist du?“ mit „Ich bin neu hier“ oder „Ich bin <Gast>“. Man ist sofort Spieler, der Gast wird nach Bestätigung durch den Verwalter übernommen.
  - Ohne Gäste: nur „Beitreten“.
- **Offene Anfrage** erscheint beim Verwalter als Karte oben im Tab „Spieler“ mit „Ablehnen“ und „Bestätigen“.

## Statistik (#13, #14)

- **Kennzahl und Zeitraum** sind zwei Auswahlfelder in einer Zeile über der Liste:
  - Kennzahl mit Icon, hervorgehoben in Primärfarbe. Zeitraum mit Kalender-Icon daneben.
  - Beide öffnen ein Bottom Sheet. Das Kennzahl-Sheet zeigt jede Kennzahl mit Icon und Kurzbeschreibung.
  - Grund: Meist wechselt man nur die Kennzahl.
- **Kennzahl-Icons:**
  - Siege: Pokal
  - Winrate: Prozent
  - Teilnahmen: Personen
  - Bomben pro Spiel: Bombe
  - Schwimmer-Quote: Wellen
  - Unbreakable: Schild
  - Untouchable: Stern
- **Rangliste:** Platz, Name (mit „Gast“), Wert und Unterzeile („aus 71 Spielen“ bzw. „14 von 64“). Gleichstand teilt sich den Platz, Platz 1 steht in Primärfarbe. Quoten unter 5 Spielen stehen in einem eigenen Abschnitt „Noch nicht gewertet, unter 5 Spielen“ („4 von 5 Spielen“).
- **Spielerprofil:**
  - Kopf mit Avatar und Name. 7 Kennzahl-Kacheln „Über alle Gruppen“ mit Zeitraum-Auswahl.
  - Darunter „Nach Gruppe“, bei Mitspielern „In euren gemeinsamen Gruppen“ mit Hinweis.
  - **Ein Tipp auf eine Gruppen-Karte öffnet die Rangliste dieser Gruppe.**

## Nachträglich entschieden (08.11.2026, Kommentar an #3)

- **Benutzername bei Registrierung über Google:** automatisch aus dem Teil der E-Mail vor dem `@` abgeleitet und normalisiert, bei Kollision mit angehängter Zahl. Danach fest wie jeder Benutzername. Der Anzeigename kommt aus dem Google-Profil und bleibt änderbar.
- **Hell und Dunkel:** Einstellung im Profil (Tab „Details“, Abschnitt „Darstellung“) mit „System“, „Hell“ und „Dunkel“. Standard ist „Dunkel“.
- **Profilbild:** wird im Browser auf 256 × 256 px verkleinert und in Postgres gespeichert (Route `/api/avatar/<id>`), kein externer Speicher. Den Ausschnitt wählt der Nutzer seit dem Nachtrag selbst (siehe unten).

## Nachträgliche Anpassungen am Design

Im Canvas auf der Seite „Nachträgliche Anpassungen“, die Boards heißen „Nachtrag #N · …“. Screens und Quellen haben die normalen Ticket-Präfixe.

### Profilbild zuschneiden (#3, 08.11.2026)

Spec: `issues/03-fundament.md` › „Nachtrag: Profilbild zuschneiden“.

- **Ohne Bild:** „Bild ändern“ öffnet die Dateiauswahl. Danach kommt ein Editor, in dem ein Kreis den Ausschnitt zeigt.
  - Der Kreis füllt die quadratische Fläche ganz aus. Die Fläche ist mittig zwischen Kopf und Aktionen.
  - Verschieben per Ziehen oder Pfeiltasten, **zoomen mit zwei Fingern** (100–300 %), am Computer per Trackpad-Pinch, Mausrad oder `+`/`−`. Es gibt keinen Regler.
  - „Übernehmen“ setzt das Bild, „Abbrechen“ ändert nichts. Bricht man die Dateiauswahl ab, passiert nichts.
- **Mit Bild:** „Bild ändern“ öffnet direkt den Editor mit dem gespeicherten Bild und Ausschnitt. Dort gibt es drei Wege:
  - denselben Ausschnitt anpassen,
  - „Anderes Bild“ (Dateiauswahl, dann anpassen),
  - „Entfernen“. Das ist erst mit „Speichern“ wirksam und lässt sich vorher mit „Bild doch behalten“ zurücknehmen.
- **Speichern fürs Nachbearbeiten (entschieden):** Damit dasselbe Bild später neu zugeschnitten werden kann, speichert die App neben dem 256-px-Bild das verkleinerte Originalbild und den Ausschnitt. Pro Nutzer gibt es genau ein Originalbild, ohne Verlauf. Ein neues Bild ersetzt es.

### Leiste mit dem letzten Ereignis (#7, 11.11.2026)

- „Rückgängig“ und „Stechen“ sind in der Spielansicht **Icon-Buttons** (44 × 44 px, `undo-2` bzw. `swords` in Primärfarbe, Hintergrund wie die Seite), mit „Rückgängig“ bzw. „Stechen angeben“ als zugänglichem Namen. Grund: Mit Text nahmen die Buttons der Ereigniszeile so viel Breite, dass lange Texte über fünf Zeilen umbrachen und die Leiste den Spielerzeilen Platz wegnahm.
- Am Spielende bleibt „Rückgängig“ mit Text, weil der Hinweis daneben ihn erklärt.

## Nicht entschieden oder nicht entworfen
- **Übernahme bestätigen lassen (zurückgestellt, #29):** Heute übernimmt jeder Teilnehmer mit Konto sofort, solange der Zähler verbunden ist (die 2-Minuten-Sperre schützt nur offline gezählte Runden, ADR 0003). Ob der verbundene Zähler die Übernahme künftig bestätigen muss, ist offen und wird erst entschieden, wenn das sofortige Übernehmen zu Problemen führt. Ablauf-Entwurf und offene Punkte stehen in #29.
- Weitere kosmetische Anpassungen will der Nutzer später nachreichen. Für die Entwicklung sind sie nicht nötig.
