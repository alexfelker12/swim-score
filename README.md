# Swim Score

Zählt Schwimmen-Spiele fester Gruppen live am Tisch und vergleicht die Spieler über Ranglisten. Begriffe: `CONTEXT.md`, Entscheidungen: `docs/adr/`, Design: `docs/design/`, Ablauf für Tickets: `docs/agents/workflow.md`.

Stack: TanStack Start (React 19, Vite), shadcn/ui auf Base UI, Tailwind 4, Postgres auf Neon mit Drizzle, better-auth (Benutzername/Passwort und Google), Pusher für Live-Benachrichtigungen, Resend für E-Mails.

## Lokal starten

1. `pnpm install`
2. `.env.example` nach `.env.local` kopieren und ausfüllen (Datenbank, `BETTER_AUTH_SECRET`, optional Google, Pusher und Resend). Ohne Resend stehen E-Mails samt Link im Server-Log, so lässt sich „Passwort vergessen“ auch lokal durchspielen.
3. Migrationen anwenden: `pnpm db:migrate`
4. `pnpm dev` und http://localhost:3000 öffnen.

## Deployment (Vercel)

Gebaut wird mit Nitro (`nitro/vite` in `vite.config.ts`). Auf Vercel erkennt Nitro die Umgebung selbst und schreibt die Build Output API nach `.vercel/output`. Eine `vercel.json` ist nicht nötig. Lokal lässt sich das mit `NITRO_PRESET=vercel pnpm build` nachstellen.

- **Umgebungsvariablen** wie in `.env.example`, mit `BETTER_AUTH_URL` = Produktions-URL.
- **DATABASE_URL:** die gepoolte Neon-Verbindung (Host mit `-pooler`).
- **Google:** In der Google Cloud Console `<BETTER_AUTH_URL>/api/auth/callback/google` als Redirect-URI eintragen.
- **Pusher:** `VITE_PUSHER_KEY` und `VITE_PUSHER_CLUSTER` werden beim Build in die Seite eingebaut. Nach einer Änderung neu deployen.
- **Pusher-Webhook** (für „Zähler ist offline“ und das Übernehmen): im Pusher-Dashboard unter „Webhooks“ einen Webhook auf `https://<deine-domain>/api/pusher/webhook` mit dem Event-Typ **Presence** anlegen. Ohne ihn weiß der Server nichts über den Zähler, und Übernehmen geht immer sofort. Lokal kommt Pusher nicht an den Webhook heran.
- **Resend:** Die Absender-Domain unter resend.com/domains verifizieren, dann `RESEND_API_KEY` und `EMAIL_FROM` (z. B. `Swim Score <noreply@deine-domain.de>`) setzen. Ohne die beiden Werte verschickt die App in Produktion keine E-Mails (und schreibt keine Links ins Log), und „Passwort vergessen“ ist ausgeblendet. Ohne eigene Domain geht es nicht: Mit dem Test-Absender `onboarding@resend.dev` stellt Resend nur an die eigene Konto-Adresse zu.
- **Migrationen** laufen nicht automatisch. Vor dem Deploy ausführen: `DATABASE_URL=… pnpm db:migrate`.
- **Region der Functions** möglichst nah an der Neon-Region, z. B. `fra1` bei `aws-eu-central-1`.

## Datenbank

- Schema: `src/server/db/schema.ts`
- Nach einer Schema-Änderung: `pnpm db:generate` erzeugt eine SQL-Migration in `drizzle/`, die mit committet wird.
- `pnpm db:migrate` wendet sie auf `DATABASE_URL` an.

## Alte Daten übernehmen (einmalig)

`pnpm import:old` übernimmt die Tracker „Bauwagen“ und „Montagsschillen“ der alten App (`alexfelker12/score-tracker`) als Gruppen, mit ihren Konten, Gästen und Spielen (#17). Code: `src/import/`, Skript: `scripts/import-old-data.ts`.

1. Die neue Datenbank muss leer sein (nur die Migrationen). Sonst bricht der Import ab, bevor er etwas schreibt.
2. `.env.import.local` anlegen (ist in `.gitignore`):
   ```
   OLD_DATABASE_URL=postgres://…   # alte Datenbank, direkte Verbindung (nicht prisma://)
   DATABASE_URL=postgres://…       # neue Datenbank (Neon)
   ```
3. Probelauf: `pnpm import:old --dry-run` macht alles in einer Transaktion, gibt den Bericht aus und nimmt alles zurück.
4. Import: `pnpm import:old`. Alles oder nichts, in einer Transaktion.

Was dabei passiert:

- **Konten** behalten ihre Id, ihr Passwort und die Verknüpfung mit Google: Anmelden geht wie vorher (gleicher Google-OAuth-Client). Sitzungen werden nicht übernommen, alle melden sich einmal neu an.
- **Benutzernamen**, die die neuen Regeln verletzen, werden angepasst und im Bericht genannt: ohne Leerzeichen am Rand, unerlaubte Zeichen werden `_`, zu kurze werden mit `_` aufgefüllt („F“ → „F__“). Konten ohne Benutzernamen (Google) bekommen ihn wie bei einer neuen Google-Anmeldung aus der E-Mail-Adresse.
- **Profilbilder** aus Vercel Blob werden geladen und wie ein Upload gespeichert (256 px, Ausschnitt mittig, später im Editor änderbar). Google-Bilder bleiben Links. Nicht ladbare Bilder nennt der Bericht, das Konto hat dann keins.
- **Ids:** Gruppen, Spieler, Spiele und Teilnehmer bekommen UUIDs, die aus der alten cuid abgeleitet sind. Ein zweiter Import in eine leere Datenbank ergibt dieselben Ids.
- **Spieler:** Spieler eines Trackers werden Spieler der Gruppe, Gäste werden Gäste (später beanspruchbar). Wer in Spielen vorkommt, aber nicht mehr im Tracker ist, wird ehemaliger Spieler.
- **Spiele:** Beendete und abgebrochene Spiele werden aus den alten Runden-Snapshots in Ereignisse umgerechnet (`src/import/convert-game.ts`), beendete bekommen ihre Zusammenfassung für die Statistik. Laufende Spiele werden ausgelassen. Ersteller des Trackers gilt als Zähler aller Spiele.
- **Eigenheiten der alten Daten:** In den ersten Spielen (bis Anfang Mai 2025) fehlt der Dealer, dort gilt die alte Reihenfolge, Platz 0 gibt zuerst. In einem Spiel hat eine Bombe schon Ausgeschiedenen Leben abgezogen (bis −2), ausgeschieden ist ausgeschieden: 0 Leben.

## Tests

`pnpm test` führt alle Tests mit Vitest aus. Getestet wird nur an den zwei Schnittstellen aus der Spec (#1):

- **Spiellogik** (`src/rules-engine/`): reine Funktionen, ohne Datenbank.
- **Import der alten Daten** (`src/import/`): die Umrechnung der alten Runden-Snapshots (Round-Trip mit anonymisierten echten Spielen aus `fixtures/old-games.json`) und der Import gegen eine Datenbank im alten Schema (`fixtures/old-schema.sql`).
- **Server-Anwendungsschicht** (`src/server/`): die Server-Befehle und better-auth gegen eine **echte Postgres-Instanz**. Jeder Test ruft `createTestApp()` aus `src/server/testing/test-app.ts` auf und bekommt eine frische Datenbank im Speicher ([PGlite](https://pglite.dev)), auf die die Migrationen aus `drizzle/` angewendet sind. Docker oder eine Datenbank-URL braucht es dafür nicht.
  - `signUp(auth, { username })` legt ein Konto an und liefert die Sitzungs-Header für Befehle.
  - `signInWithGoogle(auth, profile)` simuliert die Anmeldung mit Google; das ID-Token ist das JSON des Profils.
  - Statt an Pusher gehen die Benachrichtigungen „Spiel geändert“ in `app.notifications`.
  - Statt über Resend landen E-Mails in `app.outbox`.

Weitere Prüfungen: `pnpm typecheck`, `pnpm lint`, `pnpm check` (Formatierung).

## Server-Befehle

Befehle liegen in `src/server/` als Funktionen `(app, headers, input)` und prüfen selbst die Sitzung (`requireUser`). Eine Ablehnung ist ein `CommandError` mit `code`. `src/server/functions.ts` macht daraus TanStack-Start-Server-Funktionen, die Ablehnungen als `{ ok: false, code }` an den Client geben.
