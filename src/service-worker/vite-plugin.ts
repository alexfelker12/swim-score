import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { transformWithOxc } from "vite"
import type { Plugin, ResolvedConfig } from "vite"

// Builds src/service-worker/sw.ts into /sw.js next to the client files and
// fills in what it keeps on the device (ADR 0011). Only in production
// builds: in development there is no service worker.
//
// TanStack Start allows one entry in the client build, so the worker is not
// bundled with it: it imports nothing and is only compiled from TypeScript.

const entry = fileURLToPath(new URL("./sw.ts", import.meta.url))
const fileName = "sw.js"

/**
 * Public files the app needs to start, besides the built ones. The iOS start
 * screens are not among them: iOS loads them itself when the app starts.
 */
const publicFiles = [
  "/offline.html",
  "/manifest.json",
  "/favicon.ico",
  "/favicon.svg",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/icon-monochrome-512.png",
]

/** Built files the app loads; fonts only as woff2, which every target reads. */
function isAppFile(name: string) {
  return (
    !name.endsWith(".map") &&
    !name.endsWith(".woff") &&
    !name.endsWith(".vite/manifest.json")
  )
}

export function serviceWorker(): Plugin {
  let config: ResolvedConfig
  return {
    name: "swim-score:service-worker",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    configResolved(resolved) {
      config = resolved
    },
    async generateBundle(_options, bundle) {
      const built = Object.keys(bundle)
        .filter(isAppFile)
        .map((name) => `/${name}`)
      const precache = [...publicFiles, ...built].sort()
      // Built files carry a hash in their name, public files don't: their
      // content goes into the version, so changing e.g. offline.html also
      // makes a new version (and a new sw.js the browser installs).
      const hash = createHash("sha256").update(precache.join("\n"))
      for (const file of publicFiles) {
        hash.update(await readFile(join(config.publicDir, file)))
      }
      const version = hash.digest("hex").slice(0, 12)

      const source = await readFile(entry, "utf8")
      if (/^\s*(import|export)\b/m.test(source)) {
        throw new Error(`${entry} must stand on its own (no import/export)`)
      }
      const { code } = await transformWithOxc(source, entry, { lang: "ts" })
      const filled = code
        .replace(/(["'`])__SWIM_SCORE_PRECACHE__\1/g, JSON.stringify(precache))
        .replace(/__SWIM_SCORE_VERSION__/g, version)
      if (filled.includes("__SWIM_SCORE_")) {
        throw new Error(`${fileName}: placeholders not filled`)
      }
      this.emitFile({ type: "asset", fileName, source: filled })
    },
  }
}
