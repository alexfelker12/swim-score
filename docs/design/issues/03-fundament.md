# #3 Fundament: Konto, Datenbank, Testumgebung: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i03-anmelden.png`](../screens/i03-anmelden.png) | [`i03-anmelden`](../source/i03-anmelden.dc.html) | Anmelden |
| [`i03-registrieren.png`](../screens/i03-registrieren.png) | [`i03-anmelden`](../source/i03-anmelden.dc.html) | Registrieren (`ansicht="registrieren"`) |
| [`i03-profil.png`](../screens/i03-profil.png) | [`i03-profil`](../source/i03-profil.dc.html) | Profil, Tab „Details“ |
| [`i03-profil-statistik.png`](../screens/i03-profil-statistik.png) | [`i03-profil`](../source/i03-profil.dc.html) | Profil, Tab „Meine Statistik“ (Inhalt: #14) |
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
  - Felder: Profilbild mit „Bild ändern“, Anzeigename („So heißt du in Spielen und Ranglisten.“), Benutzername (nur lesbar), E-Mail („Nur für dich sichtbar.“), „Änderungen speichern“.
  - Darunter „Abmelden“ und „Konto löschen“ in Koralle mit Erklärung. Das Löschen selbst gehört zu #12.
- **Erreichbarkeit:** Den Avatar oben rechts auf der Startseite antippen öffnet das Profil. Nicht angemeldete Nutzer landen auf „Anmelden“ und danach auf der ursprünglichen Seite.
- **Theme:** Dunkel ist Standard (`<html class="dark">`). Die Tokens aus `tokens.css` übernimmst du in diesem Ticket.

## Abweichungen vom Ticket

- Ticket: „vorerst leere Startseite“. Das Design hat dafür den Zustand `i15-start-leer`. Die volle Startseite kommt in #15.

## Offen

- Wie bekommt ein Google-Konto seinen Benutzernamen? Vorschlag: aus der E-Mail ableiten und bei Kollision eine Zahl anhängen. Das muss der Nutzer noch entscheiden.
