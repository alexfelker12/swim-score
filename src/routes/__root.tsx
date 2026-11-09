import { useEffect } from "react"
import {
  HeadContent,
  ScriptOnce,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { getViewer } from "@/server/functions"

import appCss from "../styles.css?url"

// For the "System" theme the class can only be decided in the browser,
// before the first paint. Runs once in the server-rendered page; switching
// themes later is handled by useSystemTheme.
const systemThemeScript = `if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.classList.add("dark")`

export const Route = createRootRoute({
  beforeLoad: async () => ({ viewer: await getViewer() }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Swim Score" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <main className="mx-auto flex max-w-[500px] flex-col gap-2 p-6 pt-16">
      <h1 className="text-[30px] font-bold">Seite nicht gefunden</h1>
      <p className="text-muted-foreground">
        Diese Seite gibt es nicht.{" "}
        <a href="/" className="font-semibold text-primary">
          Zur Startseite
        </a>
      </p>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const theme = Route.useRouteContext({
    select: (context) => context.viewer?.theme ?? "dark",
  })
  useSystemTheme(theme === "system")
  return (
    <html
      lang="de"
      className={theme === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
        {theme === "system" ? (
          <ScriptOnce>{systemThemeScript}</ScriptOnce>
        ) : null}
      </head>
      <body>
        <div className="mx-auto min-h-svh max-w-[500px]">{children}</div>
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}

/** With the "System" theme, follow the device's setting, also when it changes. */
function useSystemTheme(active: boolean) {
  useEffect(() => {
    if (!active) return
    const query = matchMedia("(prefers-color-scheme: dark)")
    const apply = () =>
      document.documentElement.classList.toggle("dark", query.matches)
    apply()
    query.addEventListener("change", apply)
    return () => query.removeEventListener("change", apply)
  }, [active])
}
