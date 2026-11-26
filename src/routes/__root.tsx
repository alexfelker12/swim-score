import { useEffect } from "react"
import {
  HeadContent,
  ScriptOnce,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { PageNotFound } from "@/components/page-not-found"
import { UpdateNotice } from "@/components/update-notice"
import { appHeadLinks, appHeadMeta, themeColorTags } from "@/lib/pwa"
// Catches the browser's install event early, see the module.
import "@/lib/install-app"
import { useNoLongPressMenu } from "@/lib/no-long-press-menu"
import { registerServiceWorker } from "@/lib/service-worker"
import { keepViewer, loadViewer } from "@/lib/viewer"
import type { RouterContext } from "@/router"

import appCss from "../styles.css?url"

// For the "System" theme the class can only be decided in the browser,
// before the first paint. Runs once in the server-rendered page; switching
// themes later is handled by useSystemTheme.
const systemThemeScript = `if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.classList.add("dark")`

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => ({ viewer: await loadViewer() }),
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
  notFoundComponent: PageNotFound,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const theme = Route.useRouteContext({
    select: (context) => context.viewer?.theme ?? "dark",
  })
  useSystemTheme(theme === "system")
  useEffect(registerServiceWorker, [])
  useRememberHydratedViewer()
  useNoLongPressMenu()
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
        <div className="mx-auto max-w-[500px] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
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

/**
 * The signed-in account. In the browser it is remembered on the device after
 * every answer, and taken from there when the server can't be reached, so a
 * running Game opens offline (ADR 0012).
 */
/**
 * A page loaded from the server brings its Viewer along, without the
 * browser asking (its `beforeLoad` runs on the server): remember it too.
 * Only an account, never null: the app shell starts with null from the build
 * until the browser has asked the server or the device (ADR 0012).
 */
function useRememberHydratedViewer() {
  const viewer = Route.useRouteContext({ select: (context) => context.viewer })
  useEffect(() => {
    keepViewer(viewer)
  }, [viewer])
}
