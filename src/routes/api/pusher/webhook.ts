import { createFileRoute } from "@tanstack/react-router"
import { recordPresence } from "@/server/games"
import { getApp, getPusher } from "@/server/instance"
import { readPresenceWebhook } from "@/server/pusher"

/**
 * Pusher's presence webhook: a device opened or left a Game's presence
 * channel. Set up in the Pusher dashboard (see README).
 */
export const Route = createFileRoute("/api/pusher/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const pusher = getPusher()
        if (!pusher) return new Response(null, { status: 404 })
        const reports = readPresenceWebhook(
          pusher,
          request.headers,
          await request.text()
        )
        if (!reports) return new Response(null, { status: 401 })
        const app = getApp()
        for (const report of reports) await recordPresence(app, report)
        return new Response(null, { status: 204 })
      },
    },
  },
})
