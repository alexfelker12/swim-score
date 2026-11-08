# Swim Score: Design

Das abgenommene Oberflächen-Design (Stand 08.11.2026) für die Tickets #3–#16. Mobile only: entworfen bei 390 × 844 px, die App ist höchstens 500 px breit. Die Oberfläche ist deutsch, die Begriffe stehen in `CONTEXT.md`.

## So benutzt du das als Agent

1. **Dein Ticket** findest du in `issues/<NN>-*.md`: Screens, Verhalten, Texte, Abweichungen vom Ticket. Die gleiche Spec steht als Kommentar am GitHub-Issue.
2. **Bilder ansehen**: `screens/<name>.png` (390 × 844 bei 2×). Sie zeigen Layout, Abstände und Zustände.
3. **Genaue Werte** stehen in `source/<name>.dc.html`: Inline-Styles in px, Texte, Zustandslogik. Wie man die Dateien liest, erklärt `source/FORMAT.md`. Die Quellen sind Referenz, kein Code zum Kopieren. Gebaut wird mit TanStack Start, shadcn/ui (Base UI), Tailwind 4 und Lucide-Icons.
4. **Farben** kommen aus `tokens.css`. Die Werte gehören in `src/styles.css`, das passiert einmalig in #3. Danach nur Tokens und Tailwind-Klassen verwenden, keine Hex-Werte im Code.
5. **`decisions.md`** gilt bei Widerspruch zu Spec #1 oder einem Ticket. Steht dort eine Abweichung für dein Ticket, das Issue bzw. `CONTEXT.md` im selben PR mitziehen (siehe `docs/agents/workflow.md`).

Das Original liegt in einem privaten Design-Canvas auf claude.ai. Agents brauchen es nicht, alles Nötige liegt hier.

## Tickets → Design

| Ticket | Spec | Wichtigste Screens |
|---|---|---|
| #3 Fundament: Konto, Datenbank, Testumgebung | [03](issues/03-fundament.md) | `i03-anmelden`, `i03-registrieren`, `i03-profil` |
| #4 Gruppe anlegen und Gäste | [04](issues/04-gruppe-und-gaeste.md) | `i04-gruppe-anlegen`, `i04-spieler` |
| #5 Spiel starten und zählen | [05](issues/05-spiel-starten-und-zaehlen.md) | `i05-start-spiel`, `i05-runde-1`, `i05-bombe-konflikt`, `i05-spielende`, `i05-gruppe-spiele` |
| #6 Rückgängig, Abbrechen und Spielverlauf | [06](issues/06-rueckgaengig-abbrechen-verlauf.md) | `i06-menue`, `i06-abbrechen`, `i06-verlauf` |
| #7 Stechen und Extra-Runde mitschreiben | [07](issues/07-stechen-extra-runde.md) | `i07-stechen`, `i07-extra-runde` |
| #8 Live-Mitsehen und Zuschauer-Link | [08](issues/08-live-und-zuschauer.md) | `i08-teilnehmer-live`, `i08-zuschauer-teilen`, `i08-zuschauer` |
| #9 Zähler übernehmen | [09](issues/09-zaehler-uebernehmen.md) | `i09-uebernahme-gesperrt`, `i09-uebernahme-warnung`, `i09-abgeloest` |
| #10 Offline zählen | [10](issues/10-offline-zaehlen.md) | `i10-offline-zaehlen` |
| #11 Einladung und Gast beanspruchen | [11](issues/11-einladung-gast-beanspruchen.md) | `i11-einladen`, `i11-einladung-annehmen`, `i11-anfrage-bestaetigen` |
| #12 Gruppenverwaltung und ehemalige Spieler | [12](issues/12-gruppenverwaltung.md) | `i12-verwaltung`, `i12-gruppe-mitglied` |
| #13 Gruppen-Rangliste | [13](issues/13-gruppen-rangliste.md) | `i13-rangliste`, `i13-kennzahl`, `i13-zeitraum` |
| #14 Spielerprofil und persönliche Statistik | [14](issues/14-spielerprofil.md) | `i14-profil`, `i14-profil-mitspieler` |
| #15 Startseite | [15](issues/15-startseite.md) | `i15-start` und Zustände |
| #16 Passwort zurücksetzen | [16](issues/16-passwort-zuruecksetzen.md) | `i16-passwort-vergessen`, `i16-neues-passwort` |

#2 (Spiellogik) und #17 (Import) haben keine Oberfläche. Für #2 gilt die präzisierte Schwimmer-Regel in `decisions.md`.

Der Dateiname nennt das Ticket: `i05-…` gehört zu #5, `hell-…` sind helle Referenzen, `Main` ist die Übersicht „Grundlagen“ (`screens/Main.png`).

## Bausteine (überall gleich bauen)

Die Maße stammen aus den Quellen. In Klammern steht das Muster-Bild.

- **Kopf** 56 px: Zurück (44 × 44 px, `chevron-left`), Titel zentriert 17–20 px / 600, darunter optional eine Unterzeile 13 px gedämpft, rechts Icon-Buttons (44 × 44 px). (`i05-start-spiel`)
- **Statuszeile im Spiel** 40 px (mit „Übernehmen“ 48 px), Fläche `muted`, Radius 12 px, Innenabstand 14 px, Text 14 px, Punkt 8 px in `primary`. Offline invertiert. (`i05-runde-1`, `i10-offline-zaehlen`)
- **Spielerzeile** (`i05-schwimmer`):
  - Höhe 52–88 px, Radius 14 px, Rand 1,5 px `border`, Fläche `card`. Name 18–20 px / 600.
  - Leben als 3 Balken (84 × 10 px). Varianten:
    - Schwimmer: Rand `swimmer`.
    - Bomben-Modus: Rand `bomb`.
    - Ausgeschieden: gestrichelt, Deckkraft 0,5.
- **Dealer-Badge:** Pill 20 px hoch, `primary` auf `primary-muted` über `card`, Ring 2 px in `background`, sitzt bei `left: -6px; bottom: -7px` der Zeile. Beim Spielstart steht es im Fluss neben dem Namen. (`i05-runde-1`, `i05-start-spiel`)
- **Buttons:**
  - Primär: 52–56 px, Radius 14 px, `primary` / `primary-foreground`, 16 px / 600.
  - Sekundär: Rand 1,5 px `border`, transparent.
  - Gefährlich: `destructive` gefüllt.
  - Bombe: Rand und Text `bomb` auf `bomb-muted`.
  - Deaktiviert: Deckkraft 0,4.
- **Bottom Sheet** (`i05-bombe-konflikt`, `i06-menue`):
  - Hintergrund `scrim`, Fläche `card`, Radius 24 px oben, Rand oben 1 px, Griff 40 × 4 px, Innenabstand 10 / 20 / 24 px, Abstand 14–16 px.
  - Titel 22 px / 600. Aktionen untereinander oder nebeneinander, Haupt-Aktion zuerst bzw. rechts.
- **Segmented Tabs:** Fläche `muted`, Innenabstand 4 px, Radius 14 px. Aktiver Tab `card` mit 600, inaktive `muted-foreground`. Höhe 40 px. (`i04-spieler`, `i03-profil`)
- **Listenzeile:** mindestens 56 px, Trennlinie 1 px `border` unten, rechts `chevron-right` oder Icon-Buttons. (`i12-verwaltung`, `i13-rangliste`)
- **Badges:** Pill, 12–13 px / 500–600. „Verwalter“ in `primary` auf `primary-muted`, „Gast“ in `muted-foreground` auf `muted`. „zählt“ ebenfalls gedämpft.
- **Eingabe:** 52 px, Radius 12 px, Rand 1,5 px `border` (Fokus `primary`), Fläche `card`. Label 14 px / 500 darüber, Hinweis 13 px gedämpft darunter, Fehler in `destructive`. Passwortfelder mit `eye` / `eye-off`.
- **Warn-Sheet und Fehlerseite:** Icon links neben der Überschrift, alles linksbündig. (`i09-uebernahme-warnung`, `i08-link-abgelaufen`)
- **Fokus:** `outline: 2px solid primary; outline-offset: 2px` auf Buttons, Links und Eingaben.

## Inhalt dieses Ordners

```
docs/design/
├── README.md        dieser Einstieg
├── decisions.md     alle Design-Entscheidungen und Abweichungen von Spec/Tickets
├── tokens.css       finale Farb-Tokens für src/styles.css (hell + dunkel)
├── issues/          eine Spec pro Ticket (#3–#16)
├── screens/         gerenderte Screens (PNG, 2×)
└── source/          Design-Quellen (*.dc.html), canvas.json, FORMAT.md
```

Die Bilder kommen aus einem eigenen Renderer der Quellen. Die Schriften sind lokal eingebettet: IBM Plex Sans und für den Google-Button Roboto statt Google Sans. Kleine Abweichungen zum Canvas sind deshalb möglich, Maße und Farben stimmen.
