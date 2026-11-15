// Imports the old app's Trackers into the new database (#17). See README ›
// "Alte Daten übernehmen". Usage:
//   pnpm import:old --dry-run   (everything, then rolled back: only the report)
//   pnpm import:old             (for real, into an empty database)
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "../src/server/db/schema"
import { importOldData } from "../src/import/import-old-data"

const TRACKERS = ["Bauwagen", "Montagsschillen"]

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Environment variable ${name} is not set`)
  return value
}

const dryRun = process.argv.includes("--dry-run")
const oldClient = postgres(requireEnv("OLD_DATABASE_URL"), { max: 1 })
const newClient = postgres(requireEnv("DATABASE_URL"), {
  max: 1,
  prepare: false,
})

try {
  const report = await importOldData(
    drizzle({ client: newClient, schema }),
    {
      query: (text, params) =>
        oldClient.unsafe(text, params as Array<never>) as never,
    },
    {
      trackers: TRACKERS,
      dryRun,
      fetchImage: async (url) => {
        const response = await fetch(url)
        return response.ok ? new Uint8Array(await response.arrayBuffer()) : null
      },
    }
  )
  console.log(dryRun ? "Probelauf, nichts geschrieben.\n" : "Import fertig.\n")
  for (const g of report.groups) {
    console.log(
      `${g.name}: ${g.players} Spieler mit Konto, ${g.guests} Gäste, ${g.formerPlayers} ehemalige Spieler; ` +
        `${g.finished} beendete und ${g.cancelled} abgebrochene Spiele` +
        (g.skippedRunning ? `, ${g.skippedRunning} laufende ausgelassen` : "")
    )
  }
  console.log(`\nKonten: ${report.accounts}`)
  for (const u of report.usernames) {
    console.log(`Benutzername ${u.name}: ${u.from ?? "(keiner)"} -> ${u.to}`)
  }
  console.log(
    `Profilbilder übernommen: ${report.avatars.imported}` +
      (report.avatars.failed.length
        ? `, nicht ladbar: ${report.avatars.failed.join(", ")}`
        : "")
  )
} finally {
  await oldClient.end()
  await newClient.end()
}
