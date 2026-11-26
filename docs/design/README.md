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
| #3 Fundament: Konto, Datenbank, Testumgebung | [03](issues/03-fundament.md) | `i03-anmelden`, `i03-registrieren`, `i03-profil`, Nachtrag `i03-profilbild-*` |
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

## Nachträge

Anpassungen nach der Abnahme. Im Canvas stehen sie auf der Seite „Nachträgliche Anpassungen“, Board-Titel „Nachtrag #N · …“. Zusammengefasst sind sie in `decisions.md` › „Nachträgliche Anpassungen am Design“.

| Datum | Ticket | Thema | Spec | Screens |
|---|---|---|---|---|
| 08.11.2026 | #3 | Profilbild zuschneiden, anpassen, entfernen | [03 › Nachtrag](issues/03-fundament.md#nachtrag-profilbild-zuschneiden-08112026) | `i03-profilbild-*` |

## Bausteine (überall gleich bauen)

Gebaut wird aus den shadcn/ui-Komponenten auf Base UI in `src/components/ui` (ADR 0009). Die Maße unten stecken dort als Varianten und Größen. An der Aufrufstelle stehen nur `variant`, `size` und Layout-Klassen (Abstand, Breite, Platzierung), keine Farben, Schriftgrößen, Radien, Ränder oder Höhen. Gibt es für etwas noch keine Komponente, zuerst in shadcn suchen (shadcn-MCP oder `pnpm dlx shadcn@latest add <name>`) und den Look als Variante ergänzen.

**Seitenhöhe:** Eine Seite steckt in `Page` (`src/components/page.tsx`): mindestens `min-h-app` hoch, mit `height="screen"` genau `h-app`, wenn sie nicht scrollt (Spielansicht), nie `min-h-svh`. Ist die ganze Seite ein Formular, liegt das `<form>` in `Page` (`flex flex-1 flex-col`). `--app-height` ist die Bildschirmhöhe ohne Statusleiste und Home-Indikator; die freien Ränder hält der Wurzel-Container frei (#56). Was außerhalb davon fest positioniert ist (Sheets, Vollbild-Dialog, Update-Hinweis), hält die Ränder selbst frei (`env(safe-area-inset-*)`).

Die Maße stammen aus den Quellen. In Klammern steht das Muster-Bild, danach die Komponente.

- **Kopf** 56 px: Zurück (44 × 44 px, `chevron-left`), Titel zentriert 17–20 px / 600, darunter optional eine Unterzeile 13 px gedämpft, rechts Icon-Buttons (44 × 44 px). (`i05-start-spiel`) → `PageHeader` mit `PageHeaderBack` (Zurück als Link über `render`, `icon="close"` für ✕) und `PageHeaderTitle`; Icon-Buttons rechts `PageHeaderActions` mit `PageHeaderAction`. Titel 20 px („Runde 5“): `PageHeaderTitle size="lg"`, Unterzeile `PageHeaderDescription` in `PageHeaderContent`; Icon-Button ohne Link: `PageHeaderAction onClick`; Zurück in der History: `PageHeaderBack onClick`. Der Zurück-Link in `PageHeaderBack` gleitet wie ein Zurück (ADR 0014); ein Zurück-Link außerhalb des Kopfs bekommt dafür `viewTransition={backTransition()}`. Gruppenseite (Titel links mit Unterzeile, 60 px): `PageHeader variant="start"` mit `PageHeaderContent`, `PageHeaderTitle`, `PageHeaderDescription`. Nur Logo (Einladung öffnen): `PageHeader variant="brand"`; auf der Startseite mit Avatar-Link rechts.
- **Profil-Kopf** (Avatar neben Name und Unterzeile, `i03-profil`) → `ProfileHeading` mit `PersonAvatar`, `ProfileHeadingContent`, `ProfileHeadingTitle`, `ProfileHeadingDescription`. Spielerprofil (`i14-profil`, Name 28 px als Überschrift): `ProfileHeading size="lg"` mit `PersonAvatar size="xl"` und `ProfileHeadingTitle as="h1"`.
- **Statuszeile im Spiel** 40 px (mit „Übernehmen“ 48 px), Fläche `muted`, Radius 12 px, Innenabstand 14 px, Text 14 px, Punkt 8 px in `primary`. Offline invertiert. (`i05-runde-1`, `i10-offline-zaehlen`) → `ScorekeeperStatus` (Varianten normal, mit Übernehmen, offline), „Übernehmen“ als `Button variant="soft" size="xs"`. Darüber die Frage „Wer hat die Runde verloren?“ → `TablePrompt` (`bomb` gelb).
- **Letztes Ereignis** (Leiste unten) → `LastEventBar` mit `LastEventAction` (Icon-Button auf `background`, „Stechen“ in `primary`; mit `showLabel` Icon und Text). Ausgeblendete Ausgeschiedene → `HiddenOutNote`.
- **Spielerzeile** (`i05-schwimmer`) → `PlayerRow state="default|swimmer|bomb|out"` mit `PlayerRowTitle`, `PlayerRowName`, `LifeBar`, `SwimmerLabel` bzw. `PlayerRowOut` und `DealerBadge placement="corner"`; antippbar (`onTap`) ist die ganze Zeile ein Base-UI-Button. `ParticipantRows` setzt die Zeilen und ihre Höhe:
  - Höhe 52–88 px, Radius 14 px, Rand 1,5 px `border`, Fläche `card`. Name 18–20 px / 600.
  - Leben als 3 Balken (84 × 10 px). Varianten:
    - Schwimmer: Rand `swimmer`.
    - Bomben-Modus: Rand `bomb`.
    - Ausgeschieden: gestrichelt, Deckkraft 0,5.
- **Dealer-Badge:** Pill 20 px hoch, `primary` auf `primary-muted` über `card`, Ring 2 px in `background`, sitzt bei `left: -6px; bottom: -7px` der Zeile. Beim Spielstart steht es im Fluss neben dem Namen. (`i05-runde-1`, `i05-start-spiel`) → `Badge variant="dealer"`.
- **Buttons** → `Button`:
  - Primär: 52–56 px, Radius 14 px, `primary` / `primary-foreground`, 16 px / 600. → `variant="default"`, `size="xl"` (56 px) bzw. `"lg"` (52 px).
  - Sekundär: Rand 1,5 px `border`, transparent. → `variant="secondary"`; auf Karten-Fläche `"outline"`.
  - Gefährlich: `destructive` gefüllt. → `variant="destructive"`; als Text („Spiel abbrechen“) `"destructive-ghost"`; mit Rand (gefährliche Aktion als eigener Button: „Konto löschen“, „Gruppe verlassen“, „Entfernen“ im Profilbild-Editor) `"destructive-outline"`.
  - Bombe: Rand und Text `bomb` auf `bomb-muted`. → `variant="bomb"`.
  - Schwimmer wählen (60 px, Name 18 px): `variant="swimmer"`. Noch nicht dabei („Nicht dabei“ beim Spielstart): `"dashed"`. Aktion auf einer `muted`-Leiste: `"raised"` bzw. `"raised-primary"`.
  - Leise Primär-Aktion („Übernehmen“, Hinzufügen): `variant="soft"`. Textaktion: `"link"` oder `"ghost"`; gedämpft („2 ehemalige Spieler“) `"muted"`.
  - Icon-Aktion in Zeilen: Verknüpfen `variant="primary-ghost"`, Entfernen `"destructive-ghost"`, jeweils `size="icon"`.
  - Google: `variant="google"` (Richtlinien in `decisions.md` › Konto).
  - Auswahl, die ein Sheet öffnet: hervorgehoben (Kennzahl) `variant="selected"`, sonst (Zeitraum) `"picker"`. Hinzufügen als gestrichelte Zeile („Gruppe anlegen“): `"add"`.
  - Größen: `2xl` 64 (Haupt-Aktion der Startseite), `xl` 56, `lg` 52, `default` 48 (Leisten, Sheets), `sm` 44, `xs` 36, `icon` 44 × 44, `icon-lg` 52 × 52.
  - Deaktiviert: Deckkraft 0,4 (in `Button` eingebaut).
  - Link als Button: `<Button nativeButton={false} render={<Link … />}>`.
- **Bottom Sheet** (`i05-bombe-konflikt`, `i06-menue`) → `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`, `DrawerFooter`:
  - Hintergrund `scrim`, Fläche `card`, Radius 24 px oben, Rand oben 1 px, Griff 40 × 4 px, Innenabstand 10 / 20 / 24 px, Abstand 14–16 px.
  - Titel 22 px / 600. Aktionen untereinander (`DrawerFooter`) oder nebeneinander (`DrawerFooter orientation="horizontal"`), Haupt-Aktion zuerst bzw. rechts.
  - Gewinner: `DrawerHeader align="center"` mit `DrawerTitle size="lg"` (Pokal 32 px, 34 px / 700). Warnung: `DrawerTitle tone="warning"` (Icon in `bomb`).
  - „Zurück“ (Android-Taste/-Geste, iOS-Wischen vom Rand) schließt das oberste offene Sheet; das machen `Drawer` und `Dialog` selbst (ADR 0013), an der Aufrufstelle ist nichts zu tun.
  - Menü im Sheet („Spiel“): `Item variant="row" size="menu"` mit `ItemMedia` (Icon) und `ItemTitle`, als Button `render={<ItemButton … />}`, „Spiel abbrechen“ mit `tone="destructive"`; Ein/Aus → `Switch`.
  - Personen aus einem Raster wählen (Stechen) → `Toggle variant="seat"`, die feste Person daneben `TiebreakLoser`.
- **Segmented Tabs:** Fläche `muted`, Innenabstand 4 px, Radius 14 px. Aktiver Tab `card` mit 600, inaktive `muted-foreground`. Höhe 40 px. (`i04-spieler`, `i03-profil`) → `Tabs`, `TabsList` (Standard-Variante `segmented`), `TabsTrigger`, `TabsContent`.
- **Aktionen in Zeilen und Feldern** (Listenzeile, Spielerzeile, Link zum Kopieren, Passwortfeld): so kompakt wie möglich, weil am Handy wenig Platz ist. Gibt es ein allgemein bekanntes Icon (kopieren, entfernen, bearbeiten, teilen, Sichtbarkeit), ist es ein Icon-Button (`size="icon"`, im Feld `InputGroupButton size="icon"`) mit `aria-label`. Text nur, wo es kein solches Icon gibt („Übernehmen“). Das Icon endet 16 px vor dem Rand des Felds.
- **Rückmeldung beim Tippen:** Touch-Geräte zeigen kein `hover:`. Buttons, Tabs, Radio-Karten und antippbare Zeilen reagieren deshalb auf `active:` (Fläche wie bei Hover, Buttons schrumpfen kurz auf 97 %, Icon-Buttons auf 90 %, abgeschaltet bei reduzierter Bewegung). Das ist in den Komponenten eingebaut.
- **Spielerzeile in der Verwaltung** (`i12-verwaltung`, abweichend vom Design): Avatar, Name in Zeile 1, Zusatz („Gast, von Ben angelegt“, „du, Verwalter“) als `ItemDescription` in Zeile 2, Icon-Buttons vertikal zentriert. Ehemalige Spieler genauso, ohne Avatar. So bricht nichts um, auch bei langen Namen.
- **Gruppe als Mitglied** (`i12-gruppe-mitglied`, abweichend vom Design): Name als `Field` mit `Input readOnly` statt als großer Text, damit es keinen eigenen Baustein für nur lesbare Werte gibt (#39); Verwalter als `Section` mit `SectionTitle` und dem Namen fett in `SectionDescription`.
- **Listenzeile:** mindestens 56 px, Trennlinie 1 px `border` unten, rechts `chevron-right` oder Icon-Buttons. (`i12-verwaltung`, `i13-rangliste`) → `Item variant="row" size="list"` mit `ItemMedia`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`. Als Karte: `variant="card"`; zum Öffnen (Gruppe auf der Startseite, 68 px, Titel 17 px, Zusatz 15 px): `variant="card" size="lg"`.
- **Rangliste** (`i13-rangliste`) → `RankingRow` (Platz 1 mit `first`, noch nicht gewertet mit `pending`, mit Konto als Link über `render`) mit `RankingPlace`, `RankingName` („Gast“ als `Badge variant="plain"`), `RankingValue` (Wert mit Zusatz darunter) bzw. `RankingNote`.
- **Kennzahl und Zeitraum** (`i13-kennzahl`, `i13-zeitraum`) → `MetricPicker` mit `MetricPickerTrigger` und `MetricPickerContent`, `PeriodPicker` mit `PeriodPickerTrigger` und `PeriodPickerContent` („Eigener Zeitraum“ mit zwei `DateInput`). Die Auswahl im Sheet: `RadioGroup variant="list"` mit `RadioRow`, `RadioRowMedia`, `RadioRowContent`, `RadioRowTitle` (`weight="strong"`: immer 600), `RadioRowDescription`, `RadioRowIndicator` (Haken).
- **Badges:** Pill, 12–13 px / 500–600. „Verwalter“ in `primary` auf `primary-muted`, „Gast“ in `muted-foreground` auf `muted`. „zählt“ ebenfalls gedämpft. → `Badge variant="primary"` bzw. `"muted"`. Notiz neben einem Namen ohne Pill („du“, „Gast, von Ben angelegt“): `"plain"`.
- **Karten** → `Card` mit `CardHeader`, `CardLabel`, `CardTitle`, `CardAction`, `CardDescription`, `CardFooter`; Varianten `default`, `primary` (läuft/wartet), `dashed` (zählt nicht), `muted` (Hinweis ohne Rand); Größe `sm` für Listeneinträge (Gruppen in der Statistik), `xs` für Kennzahl-Kacheln, `md` für ein laufendes Spiel unter mehreren und `lg` für das laufende Spiel allein (beide Radius 18 px). `CardTitle size="lg"` 22 px, `"xl"` 28 px, als Überschrift `as="h2"`. „● Spiel läuft“ auf der Startseite: `GameCardStatus size="lg"`; Schwimmer im Stand `GameCardSwimmer strong`. Als Link über `render`. Spiele in der Gruppe (#60): `GameCard status="running|finished|cancelled"` mit `GameCardHeader`, `GameCardStatus` oder `GameCardTitle` (Icon davor: Pokal in `primary` vor dem Namen des Gewinners, ohne „gewinnt“; abgebrochen ⊘; Name in `GameCardName`, kürzt mit „…“), `GameCardDate`; darunter `GameCardFacts` mit zwei `GameCardFactRow` aus je zwei `GameCardFact icon label tone`: links wer (Teilnehmer; Schwimmer in Blau, sonst leise „ohne/noch kein Schwimmer“, bei abgebrochenen „zählt nicht“), rechts bündig unter dem Datum die Zahlen (Runden bzw. Zähler; Dauer „47 Min.“/„1:35 Std.“). Alle Karten sind gleich hoch, nichts bricht um. Filter darüber als `Toggle variant="chip"` in `ChipRow` › `ChipRowChips` (seitlich scrollend, ohne Scrollbalken, an beiden Rändern ausblendend); sobald einer aktiv ist, rechts fest in `ChipRowAction` der Icon-Button „Filter zurücksetzen“ (FilterX), der nie wegscrollt.
- **Abschnitt** mit Überschrift („Spieler“, „Verwalter“, „Wer bist du?“, Monat über den Spielen) → `Section`, `SectionTitle` (`default` 17 px, `muted` 15 px gedämpft, `lg` 20 px, `page` 30 px), `SectionDescription` (`size="lg"` 18 px unter einem `page`-Titel).
- **Aktionen am Seitenende** → `PageFooter` (`default`, `sticky` mit Linie und Hintergrund, `bordered` unter einem scrollenden Bereich).
- **QR-Code** → `QrCard` (weiße Karte, `size="default"` 248 px, `"sm"` 212 px) mit `QrCode`. Link zum Kopieren → `LinkField`.
- **Avatar** → `PersonAvatar` mit `name` und `image` (Bild, sonst Anfangsbuchstabe in `primary` auf `muted`; als Link über `render`), aufgebaut aus `Avatar`, `AvatarImage` und `AvatarFallback`. Größen: `default` 36, `md` 44, `lg` 56, `xl` 64, `2xl` 160 (Profilbild-Editor ohne Bild). In Spielerlisten Konten mit Ring `variant="account"`, Gäste gestrichelt `variant="guest"`.
- **Eingabe:** 52 px, Radius 12 px, Rand 1,5 px `border` (Fokus `primary`), Fläche `card`. Label 14 px / 500 darüber, Hinweis 13 px gedämpft darunter, Fehler in `destructive`. Passwortfelder mit `eye` / `eye-off`. → `Field`, `FieldLabel`, `Input`, `FieldDescription`, `FieldError`; Hinweis, der bei einem Fehler durch die Meldung ersetzt wird: `FieldNote`. Passwortfeld fertig: `PasswordInput`. Passwort und Link zum Kopieren: `InputGroup` mit `InputGroupInput` und `InputGroupButton size="icon"` (`eye`/`eye-off`, `copy`, danach `check`). Nur lesbarer Wert: `Input readOnly` (gedämpft, ohne Rand).
- **Datum und Auswahl:** nativ. Datum → `DateInput` (natives `type="date"` mit eigenem `calendar`-Icon, weil Browser unterschiedliche Indikatoren zeigen), Auswahl → `NativeSelect` mit `NativeSelectOption`.
- **Einstellung mit wenigen kurzen Optionen** (Darstellung: System / Hell / Dunkel), sieht aus wie die Segmented Tabs → `RadioGroup variant="segmented"` mit `RadioSegment` (Icon optional vor dem Text).
- **Einzelauswahl als Karten** („Wer bist du?“) → `RadioGroup` mit `RadioCard`, `RadioCardTitle`, `RadioCardDescription`.
- **Hinweis** („Link unterwegs“) → `Alert` mit Icon; gedämpfte Notiz auf `muted` („Am Tisch geht es am schnellsten“) `Alert variant="note"`; Fehler-Box → `Alert variant="destructive"`; schwebend über der Seite („Neue Version verfügbar“) → `Alert variant="floating"`, oben fixiert in `UpdateNotice`. Kompakt mit Titel, kurzer Zeile und Aktionen rechts („Swim Score als App“) → `Alert variant="floating" size="compact"` mit `AlertAction`, unten auf der Startseite in `InstallHint`.
- **Spielende** → `WinnerHeading` und `ResultTable` mit `ResultRow` (auf `Table`; Platz 1 in `primary`, Schwimmer-Zeile getönt). **Verlauf** → `GameOutcome`, `HistoryList`, `HistoryEntry`. **Sitzreihenfolge** beim Start → `SeatList`, `SeatRow`, `SeatGrip`, `SeatNumber`, `SeatName`, `SeatRemove`, `SeatCandidate`; Zähler neben der Überschrift `Badge variant="count"` bzw. `"count-error"`. Fehler, der die Haupt-Aktion sperrt: `FieldError size="lg"` mit Icon.
- **Lange Listen** (Spiele, Spieler, Meine Gruppen) laden seitenweise nach (ADR 0017): Einträge aus `usePagedQuery`, am Ende `ListEnd` mit zwei Platzhaltern im Layout der Einträge (`Skeleton`); ohne Verbindung zeigt es „Weitere laden“.
- **Tabelle** sonst → `Table`. **Trenner** „oder“ → `Separator`. **Laden** (`i15-start-laden`) → `Skeleton`: Block (`muted`, Radius 14 px), `variant="line"` (Textzeile), `variant="card"` (Karte in `card`, die Zeilen und Blöcke hält), `variant="circle"` (Profilbild). Jede Seite mit Daten hat einen Ladezustand aus `PageLoading`, `PageLoadingHeader` und `PageLoadingContent` im Layout der Seite (ADR 0016).
- **Warn-Sheet und Fehlerseite:** Icon links neben der Überschrift, alles linksbündig. (`i09-uebernahme-warnung`, `i08-link-abgelaufen`) → Icon als erstes Kind von `DrawerTitle`; ganze Fehlerseite → `LinkGone` mit `LinkGoneTitle` (Icon über `icon`, Standard `unlink`; „Keine Verbindung“ mit `wifi-off` in `PageError`).
- **Vollbild-Dialog** (nur der Profilbild-Editor, `i03-profilbild-neu`): Kopf 56 px mit zentriertem Titel. Fußleiste mit Trennlinie oben, Innenabstand 12 / 16 / 24 px, zwei Buttons nebeneinander. → `Dialog`, `DialogContent variant="fullscreen"`, `DialogHeader`, `DialogTitle`, `DialogFooter`.
- **Fokus:** `outline: 2px solid primary; outline-offset: 2px` auf Buttons, Links, Tabs und Radios; Eingaben zeigen den Fokus als Rand in `primary` (beides in den Komponenten eingebaut).

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
