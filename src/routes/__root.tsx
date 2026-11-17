import { useEffect } from "react"
import {
  HeadContent,
  Link,
  ScriptOnce,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { SectionDescription, SectionTitle } from "@/components/section"
import { Button } from "@/components/ui/button"
import { UpdateNotice } from "@/components/update-notice"
import { appHeadLinks, appHeadMeta, themeColorTags } from "@/lib/pwa"
// Catches the browser's install event early, see the module.
import "@/lib/install-app"
import { registerServiceWorker } from "@/lib/service-worker"
import { getViewer } from "@/server/functions"
import type { RouterContext } from "@/router"

import appCss from "../styles.css?url"

// For the "System" theme the class can only be decided in the browser,
// before the first paint. Runs once in the server-rendered page; switching
// themes later is handled by useSystemTheme.
const systemThemeScript = `if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.classList.add("dark")`

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => ({ viewer: await getViewer() }),
  head: ({ match }) => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Swim Score" },
      ...appHeadMeta(match.context.viewer?.theme ?? "dark"),
    ],
    links: [{ rel: "stylesheet", href: appCss }, ...appHeadLinks],
  }),
  notFoundComponent: () => (
    <main className="mx-auto flex max-w-[500px] flex-col items-start gap-2 p-6 pt-16">
      <SectionTitle as="h1" variant="page">
        Seite nicht gefunden
      </SectionTitle>
      <SectionDescription size="lg">
        Diese Seite gibt es nicht.
      </SectionDescription>
      <Button variant="link" nativeButton={false} render={<Link to="/" />}>
        Zur Startseite
      </Button>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const theme = Route.useRouteContext({
    select: (context) => context.viewer?.theme ?? "dark",
  })
  useSystemTheme(theme === "system")
  useEffect(registerServiceWorker, [])
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
        {themeColorTags(theme).map(({ color, media }) => (
          <meta key={color} name="theme-color" content={color} media={media} />
        ))}
      </head>
      <body>
        <div className="mx-auto min-h-svh max-w-[500px]">{children}</div>
        <UpdateNotice />
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
