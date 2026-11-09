import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"

/** Every page below here needs a signed-in account. */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (!context.viewer) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } })
    }
    return { viewer: context.viewer }
  },
  component: Outlet,
})
