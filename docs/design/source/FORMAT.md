# Design-Quellen lesen

Jede `*.dc.html` ist ein Screen aus dem Design-Canvas. Das ist **Referenz, kein Produktionscode**: Maße, Farben, Texte und Zustände übernehmen, aber in React/TanStack Start mit shadcn/ui (Base UI) und Tailwind neu bauen.

## Aufbau einer Datei

- `<helmet><style>`: Theme-Klassen `.th-dark` / `.th-light` mit den Farbkürzeln (`--bg`, `--pr` …). Die Zuordnung zu den App-Tokens steht oben in `../tokens.css`.
- Markup in `<x-dc>`: normales HTML mit Inline-Styles. Platzhalter:
  - `{{name}}` ist ein Wert aus `renderVals()`.
  - `<sc-if value="{{x}}">` heißt: nur anzeigen, wenn `x` wahr ist.
  - `<sc-for list="{{xs}}" as="x">` wiederholt den Inhalt für jedes Element.
  - `<dc-import name="Datei" prop="…">` bettet einen anderen Screen mit Props ein. Kebab-Case-Attribute werden zu camelCase-Props.
- `<script type="text/x-dc" data-dc-script data-props='…'>`:
  - `data-props` listet die Varianten-Schalter, z. B. `scenario`, `theme`, `zustand`.
  - `class Component` berechnet in `renderVals()` die Werte. Dort stehen auch Beispieldaten und, in `SpielScreen.dc.html`, ein Replay der Spielereignisse (`lost`, `bomb`, `extra`) für den klickbaren Prototyp.
  - Maßgeblich für die Spielregeln bleibt die Spiellogik aus #2, nicht dieser Prototyp.

## Wrapper und Basis-Screens

Viele Dateien sind nur Wrapper: Sie importieren einen Basis-Screen mit anderen Props. Ein Beispiel ist `i05-bombe-konflikt.dc.html`: Es bettet `SpielScreen` mit `scenario="konflikt"` ein. Den eigentlichen Code findest du im Basis-Screen:

| Basis-Screen | Wrapper (Props) |
|---|---|
| `SpielScreen` | alle `i05-*` außer `i05-start-*` und `i05-gruppe-spiele`; `i06-menue`, `i06-abbrechen`, `i06-ausgeblendet`, `i07-*`, `i08-teilnehmer-live`, `i08-zuschauer*`, `i09-*`, `i10-*`, `hell-runde`, `hell-spielende` (Prop `scenario`; `leben` für die Lebensdarstellung) |
| `i05-start-spiel` | `i05-start-zu-wenig`, `i05-start-zu-viele` (`anzahl`) |
| `i03-anmelden` | `i03-registrieren`, `i16-passwort-vergessen`, `i16-neues-passwort` (`ansicht`) |
| `i03-profil` | `i03-profil-statistik` (`tab`), `i03-profilbild-profil-ohne`, `i03-profilbild-profil-mit` (`bild`) |
| `i03-profilbild` | `i03-profilbild-neu`, `-angepasst`, `-bearbeiten`, `-anderes`, `-entfernt` (`zustand`) |
| `i15-start` | `i15-start-*`, `hell-start` (`zustand`) |
| `i04-spieler` | `i04-spieler-mitglied` (`rolle`), `i11-anfrage-bestaetigen` (`anfrage`) |
| `i12-verwaltung` | `i12-gast-verknuepfen` (`dialog`), `i12-gruppe-mitglied` (`rolle`) |
| `i11-einladung-annehmen` | `i11-einladung-ohne-gaeste` (`gaeste`) |
| `i08-link-abgelaufen` | `i11-einladung-ungueltig` (`variante`) |
| `i13-rangliste` | `i13-kennzahl`, `i13-zeitraum`, `i13-rangliste-winrate`, `hell-rangliste` |
| `i14-profil` | `i14-profil-mitspieler` (`wer`) |

`canvas.json` ordnet jedem Screen einen Titel und eine Canvas-Seite zu. `Main.dc.html` ist die Übersicht „Grundlagen“ mit Farben, Schrift und Bausteinen.

Zu jeder Quelle gibt es ein gerendertes Bild unter `../screens/<gleicher Name>.png`, 390 × 844 px bei doppelter Auflösung.
