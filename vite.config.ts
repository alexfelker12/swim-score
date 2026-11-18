import { defineConfig, loadEnv } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { nitro } from "nitro/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { serviceWorker } from "./src/service-worker/vite-plugin"

const config = defineConfig(({ mode }) => {
  // Server code reads its settings (DATABASE_URL, …) from process.env; this
  // makes .env and .env.local available there during development.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""), process.env)
  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackStart({
        // Also prerenders an app shell without data (/_shell.html); the
        // service worker answers pages with it when the server can't be
        // reached. The server still renders every page (ADR 0012).
        spa: { enabled: true, prerender: { outputPath: "/_shell" } },
      }),
      nitro(),
      viteReact(),
      serviceWorker(),
    ],
  }
})

export default config
