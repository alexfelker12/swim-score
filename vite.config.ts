import { defineConfig, loadEnv } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { nitro } from "nitro/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const config = defineConfig(({ mode }) => {
  // Server code reads its settings (DATABASE_URL, …) from process.env; this
  // makes .env and .env.local available there during development.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""), process.env)
  return {
    resolve: { tsconfigPaths: true },
    plugins: [devtools(), tailwindcss(), tanstackStart(), nitro(), viteReact()],
  }
})

export default config
