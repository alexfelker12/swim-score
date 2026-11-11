# Swim Score

Zählt Schwimmen-Spiele fester Gruppen live am Tisch und vergleicht die Spieler über Ranglisten. Begriffe: `CONTEXT.md`, Entscheidungen: `docs/adr/`, Design: `docs/design/`, Ablauf für Tickets: `docs/agents/workflow.md`.

Stack: TanStack Start (React 19, Vite), shadcn/ui auf Base UI, Tailwind 4, Postgres auf Neon mit Drizzle, better-auth (Benutzername/Passwort und Google), Pusher für Live-Benachrichtigungen.

## Lokal starten

1. `pnpm install`
2. `.env.example` nach `.env.local` kopieren und ausfüllen (Datenbank, `BETTER_AUTH_SECRET`, optional Google und Pusher).
3. Migrationen anwenden: `pnpm db:migrate`
4. `pnpm dev` und http://localhost:3000 öffnen.

## Deployment (Vercel)

Gebaut wird mit Nitro (`nitro/vite` in `vite.config.ts`). Auf Vercel erkennt Nitro die Umgebung selbst und schreibt die Build Output API nach `.vercel/output`. Eine `vercel.json` ist nicht nötig. Lokal lässt sich das mit `NITRO_PRESET=vercel pnpm build` nachstellen.

- **Umgebungsvariablen** wie in `.env.example`, mit `BETTER_AUTH_URL` = Produktions-URL.
- **DATABASE_URL:** die gepoolte Neon-Verbindung (Host mit `-pooler`).
- **Google:** In der Google Cloud Console `<BETTER_AUTH_URL>/api/auth/callback/google` als Redirect-URI eintragen.
- **Pusher:** `VITE_PUSHER_KEY` und `VITE_PUSHER_CLUSTER` werden beim Build in die Seite eingebaut. Nach einer Änderung neu deployen.
- **Migrationen** laufen nicht automatisch. Vor dem Deploy ausführen: `DATABASE_URL=… pnpm db:migrate`.
- **Region der Functions** möglichst nah an der Neon-Region, z. B. `fra1` bei `aws-eu-central-1`.

## Datenbank

- Schema: `src/server/db/schema.ts`
- Nach einer Schema-Änderung: `pnpm db:generate` erzeugt eine SQL-Migration in `drizzle/`, die mit committet wird.
- `pnpm db:migrate` wendet sie auf `DATABASE_URL` an.

## Tests

`pnpm test` führt alle Tests mit Vitest aus. Getestet wird nur an den zwei Schnittstellen aus der Spec (#1):

- **Spiellogik** (`src/rules-engine/`): reine Funktionen, ohne Datenbank.
- **Server-Anwendungsschicht** (`src/server/`): die Server-Befehle und better-auth gegen eine **echte Postgres-Instanz**. Jeder Test ruft `createTestApp()` aus `src/server/testing/test-app.ts` auf und bekommt eine frische Datenbank im Speicher ([PGlite](https://pglite.dev)), auf die die Migrationen aus `drizzle/` angewendet sind. Docker oder eine Datenbank-URL braucht es dafür nicht.
  - `signUp(auth, { username })` legt ein Konto an und liefert die Sitzungs-Header für Befehle.
  - `signInWithGoogle(auth, profile)` simuliert die Anmeldung mit Google; das ID-Token ist das JSON des Profils.
  - Statt an Pusher gehen die Benachrichtigungen „Spiel geändert“ in `app.notifications`.

Weitere Prüfungen: `pnpm typecheck`, `pnpm lint`, `pnpm check` (Formatierung).

## Server-Befehle

Befehle liegen in `src/server/` als Funktionen `(app, headers, input)` und prüfen selbst die Sitzung (`requireUser`). Eine Ablehnung ist ein `CommandError` mit `code`. `src/server/functions.ts` macht daraus TanStack-Start-Server-Funktionen, die Ablehnungen als `{ ok: false, code }` an den Client geben.
