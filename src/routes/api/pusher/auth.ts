import { createFileRoute } from "@tanstack/react-router"
import { gameOfPresenceChannel } from "@/lib/live"
import { CommandError } from "@/server/errors"
import { authorizePresence } from "@/server/games"
import { getApp, getPusher } from "@/server/instance"

/**
 * Pusher asks here whether the signed-in browser may join a Game's presence
 * channel, and as whom (ADR 0003).
 */
export const Route = createFileRoute("/api/pusher/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const pusher = getPusher()
        if (!pusher) return new Response(null, { status: 404 })
        const form = new URLSearchParams(await request.text())
        const socketId = form.get("socket_id")
        const channel = form.get("channel_name")
        const gameId = channel ? gameOfPresenceChannel(channel) : null
        if (!socketId || !channel || !gameId) {
          return new Response(null, { status: 400 })
        }
        try {
          const { userId } = await authorizePresence(
            getApp(),
            request.headers,
            {
              gameId,
            }
          )
          return Response.json(
            pusher.authorizeChannel(socketId, channel, { user_id: userId })
          )
        } catch (error) {
          // Pusher's client expects 403 for "not allowed".
          if (error instanceof CommandError) {
            return new Response(null, { status: 403 })
          }
          // A malformed socket id.
          if (error instanceof Error && /socket_id/i.test(error.message)) {
            return new Response(null, { status: 400 })
          }
          throw error
        }
      },
    },
  },
})
