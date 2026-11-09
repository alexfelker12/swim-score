# #3 Fundament: Konto, Datenbank, Testumgebung: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i03-anmelden.png`](../screens/i03-anmelden.png) | [`i03-anmelden`](../source/i03-anmelden.dc.html) | Anmelden |
| [`i03-registrieren.png`](../screens/i03-registrieren.png) | [`i03-anmelden`](../source/i03-anmelden.dc.html) | Registrieren (`ansicht="registrieren"`) |
| [`i03-profil.png`](../screens/i03-profil.png) | [`i03-profil`](../source/i03-profil.dc.html) | Profil, Tab „Details“ |
| [`i03-profil-statistik.png`](../screens/i03-profil-statistik.png) | [`i03-profil`](../source/i03-profil.dc.html) | Profil, Tab „Meine Statistik“ (Inhalt: #14) |
| [`i03-profilbild-profil-ohne.png`](../screens/i03-profilbild-profil-ohne.png) | [`i03-profil`](../source/i03-profil.dc.html) | Nachtrag: Profil ohne Bild |
| [`i03-profilbild-neu.png`](../screens/i03-profilbild-neu.png) | [`i03-profilbild`](../source/i03-profilbild.dc.html) | Nachtrag: Bild gewählt, Ausschnitt im Kreis |
| [`i03-profilbild-angepasst.png`](../screens/i03-profilbild-angepasst.png) | [`i03-profilbild`](../source/i03-profilbild.dc.html) | Nachtrag: verschoben und vergrößert |
| [`i03-profilbild-profil-mit.png`](../screens/i03-profilbild-profil-mit.png) | [`i03-profil`](../source/i03-profil.dc.html) | Nachtrag: Profil mit Bild (`bild="true"`) |
| [`i03-profilbild-bearbeiten.png`](../screens/i03-profilbild-bearbeiten.png) | [`i03-profilbild`](../source/i03-profilbild.dc.html) | Nachtrag: vorhandenes Bild anpassen |
| [`i03-profilbild-anderes.png`](../screens/i03-profilbild-anderes.png) | [`i03-profilbild`](../source/i03-profilbild.dc.html) | Nachtrag: anderes Bild gewählt |
| [`i03-profilbild-entfernt.png`](../screens/i03-profilbild-entfernt.png) | [`i03-profilbild`](../source/i03-profilbild.dc.html) | Nachtrag: entfernt, noch nicht gespeichert |
| [`i15-start-leer.png`](../screens/i15-start-leer.png) | [`i15-start`](../source/i15-start.dc.html) | Startseite ohne Gruppe (für #3 reicht diese leere Startseite) |

## Verhalten und Texte

- **Anmelden:**
  - Logo oben links, Überschrift „Anmelden“. Zuerst der Google-Button, dann der Trenner „oder“, dann Benutzername und Passwort.
  - Das Passwortfeld hat einen Augen-Schalter. Darunter rechts der Link „Passwort vergessen?“ (#16).
  - Haupt-Button „Anmelden“, unten „Noch kein Konto? Registrieren“.
- **Registrieren:**
  - Google-Button, „oder“, dann die Felder mit ihren Hinweisen:
    - Benutzername: „Damit meldest du dich an. Deinen Anzeigenamen änderst du später im Profil.“
    - E-Mail: „Nur für das Zurücksetzen des Passworts. Niemand in deinen Gruppen sieht sie.“
    - Passwort: „Mindestens 8 Zeichen.“
    - Passwort bestätigen.
  - Beide Passwortfelder haben einen Augen-Schalter (eye / eye-off).
  - Kein Hinweis-Kasten oben, Fehler stehen am jeweiligen Feld.
- **Google-Button** genau nach Richtlinie (siehe `decisions.md` › Konto). Er braucht die Schrift Google Sans Medium, Fallback Roboto Medium.
- **Benutzername und Anzeigename:**
  - better-auth-Plugin `username`, `username` = normalisierte Kleinschreibung, `displayUsername` = Originalschreibung, Anzeigename = `user.name`.
  - Den Benutzernamen mit `immutableUsername: true` sperren. Im Profil erscheint er nur lesbar mit dem Hinweis „Damit meldest du dich an. Lässt sich nicht ändern.“
  - Vorschlag (nicht entworfen): Nach dem Registrieren ist der Anzeigename zunächst der Benutzername.
- **Profil, Tab „Details“:**
  - Kopf: Avatar (Initiale, wenn kein Bild), Anzeigename und `@benutzername`.
  - Felder: Profilbild mit „Bild ändern“ (öffnet den Editor, siehe „Nachtrag: Profilbild zuschneiden“), Anzeigename („So heißt du in Spielen und Ranglisten.“), Benutzername (nur lesbar), E-Mail („Nur für dich sichtbar.“), „Änderungen speichern“.
  - Darunter „Abmelden“ und „Konto löschen“ in Koralle mit Erklärung. Das Löschen selbst gehört zu #12.
- **Erreichbarkeit:** Den Avatar oben rechts auf der Startseite antippen öffnet das Profil. Nicht angemeldete Nutzer landen auf „Anmelden“ und danach auf der ursprünglichen Seite.
- **Theme:** Dunkel ist Standard (`<html class="dark">`). Die Tokens aus `tokens.css` übernimmst du in diesem Ticket.

## Abweichungen vom Ticket

- Ticket: „vorerst leere Startseite“. Das Design hat dafür den Zustand `i15-start-leer`. Die volle Startseite kommt in #15.

## Nachträglich entschieden

- Benutzername über Google, Hell/Dunkel-Einstellung und Speicherort des Profilbilds: siehe `decisions.md` › „Nachträglich entschieden“.

## Nachtrag: Profilbild zuschneiden (08.11.2026)

Ersetzt den bisherigen Ablauf, in dem das gewählte Bild sofort mittig quadratisch zugeschnitten und gesetzt wird (`src/lib/resize-image.ts`). Canvas-Seite „Nachträgliche Anpassungen“.

### Ablauf

- **Noch kein Profilbild:**
  1. „Bild ändern“ öffnet die Dateiauswahl (`accept="image/*"`). Bricht man sie ab, passiert nichts.
  2. Der Editor öffnet sich mit dem gewählten Bild (`i03-profilbild-neu`).
  3. Optional verschieben und vergrößern (`i03-profilbild-angepasst`).
  4. „Übernehmen“ speichert und schließt (`i03-profilbild-profil-mit`). „Abbrechen“ schließt ohne Änderung.
- **Profilbild vorhanden:** „Bild ändern“ öffnet **direkt** den Editor mit dem gespeicherten Bild und dem gespeicherten Ausschnitt (`i03-profilbild-bearbeiten`). Von dort:
  - **Anpassen:** verschieben und zoomen, dann „Übernehmen“.
  - **„Anderes Bild“:** Dateiauswahl, danach dieselbe Ansicht mit dem neuen Bild, Ausschnitt zurückgesetzt (`i03-profilbild-anderes`). Bricht man die Auswahl ab, bleibt das bisherige Bild im Editor.
  - **„Entfernen“:** Die Vorschau zeigt die Initiale und „Ohne Bild sehen alle in deinen Gruppen deine Initiale.“ (`i03-profilbild-entfernt`).
    - Der Haupt-Button heißt jetzt „Speichern“. Erst damit wird das Bild gelöscht, und das Profil zeigt wieder die Initiale.
    - „Bild doch behalten“ nimmt das Entfernen zurück, „Bild auswählen“ öffnet die Dateiauswahl.
  - „Abbrechen“ verwirft alles.

### Editor

- **Form:** Vollbild-Dialog (`role="dialog"`, `aria-modal`), Titel „Profilbild“. Fußleiste mit „Abbrechen“ (sekundär) und „Übernehmen“ bzw. „Speichern“ (primär), je 52 px.
- **Anordnung:** Ausschnittsfläche, Hinweis und Vorschau bilden eine Gruppe, die zwischen Kopf und Aktionsreihe **vertikal zentriert** ist. Die Aktionsreihe sitzt unten über der Fußleiste.
- **Ausschnittsfläche:**
  - Quadrat über die Inhaltsbreite (342 px bei 390 px Bildschirm), Radius 20 px, Grund #0B0C0D.
  - Der Kreis füllt das Quadrat **vollständig**, ohne Innenabstand (Durchmesser = Kantenlänge). Nur die Ecken außerhalb des Kreises sind zu 58 % abgedunkelt. Der Kreis hat eine 2-px-Linie in Weiß (90 %).
  - Darunter der Hinweis „Ziehen zum Verschieben, mit zwei Fingern zoomen“ mit `move`-Icon.
- **Zoom, ohne Regler:**
  - **Pinch mit zwei Fingern** auf der Fläche. Der Mittelpunkt der beiden Finger verschiebt das Bild mit.
  - Am Computer per Trackpad-Pinch (kommt als `wheel` mit `ctrlKey`), Mausrad und die Tasten `+` / `−` (10 %), wenn die Fläche fokussiert ist.
  - 100 % heißt: Die kurze Bildseite füllt genau den Kreis. Bis 300 %.
- **Verschieben:**
  - Per Pointer mit einem Finger oder der Maus (`touch-action: none` auf der Fläche) und per Pfeiltasten (10 px, mit Shift 40 px).
  - Die Position wird so begrenzt, dass der Kreis immer vollständig mit Bild gefüllt ist.
  - Zum Umsetzen: Pointer Events für beide Gesten verwenden (aktive Pointer merken; bei zwei Pointern Abstand und Mitte vergleichen). Die Quelle `i03-profilbild.dc.html` zeigt die Logik (`gestureStart`, `move`).
- **Vorschau:** zwei kleine Avatare (56 und 36 px) mit „So sehen dich die anderen in Listen und Spielen.“
- **Zweite Aktionsreihe:**
  - „Anderes Bild“ immer.
  - „Entfernen“ (Text in `destructive`) nur, wenn schon ein Profilbild gespeichert ist.
  - Im entfernten Zustand heißt der linke Button „Bild auswählen“.
- **Fehler:** Lässt sich ein Bild nicht lesen, schließt der Editor nicht. Er zeigt unter der Fläche „Dieses Bild ließ sich nicht verwenden.“ (Text wie heute).

### Speichern (entschieden 08.11.2026)

- **Avatar:** Weiterhin 256 × 256 px, im Browser aus dem gewählten Ausschnitt gerendert (WebP, sonst JPEG), max. 256 KB, wie bisher in `avatar`.
- **Pro Nutzer genau ein Originalbild**, es gibt keinen Verlauf. Ein neues Bild ersetzt Original, Ausschnitt und Avatar.
- **Zum erneuten Zuschneiden** zusätzlich speichern (Größen sind Richtwerte):
  - `source`: das Originalbild, im Browser auf längste Seite 1600 px verkleinert, WebP/JPEG, mit eigener Größengrenze (z. B. 1 MB).
  - `crop`: der Ausschnitt **relativ zum Quellbild** (`{ x, y, size }` als Anteile 0–1), damit er unabhängig von der Bildschirmgröße ist. Der Editor rechnet daraus Zoom und Position zurück.
- **Altbestand:** Avatare von vor dem Nachtrag haben keine Quelle. Der Editor nimmt dann das 256-px-Bild als Quelle mit vollem Ausschnitt.
- **Entfernen** ist eine eigene Server-Funktion: Sie löscht die `avatar`-Zeile samt Quelle und setzt `user.image` auf `null`.
- **Abbrechen** schickt nichts an den Server.

### Offen

- **Barrierefreiheit:** Für Pinch verlangt WCAG 2.5.1 eine Ein-Finger-Alternative, und Tasten oder Mausrad zählen nicht dazu. Ohne Regler fehlt sie. Eine Möglichkeit wären zwei kleine Buttons − / ＋ an der Fläche. Entscheidung offen.
