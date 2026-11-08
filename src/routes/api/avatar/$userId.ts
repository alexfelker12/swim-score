import { createFileRoute } from "@tanstack/react-router"
import { CommandError } from "@/server/errors"
import { getApp } from "@/server/instance"
import { getAvatar } from "@/server/profile"

export const Route = createFileRoute("/api/avatar/$userId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const image = await getAvatar(
            getApp(),
            request.headers,
            params.userId
          )
          if (!image) return new Response(null, { status: 404 })
          return new Response(new Uint8Array(image.data), {
            headers: {
              "content-type": image.contentType,
              "x-content-type-options": "nosniff",
              // The URL changes with every upload (?v=…), so caching is safe.
              "cache-control": "private, max-age=31536000, immutable",
            },
          })
        } catch (error) {
          if (error instanceof CommandError) {
            return new Response(null, { status: 401 })
          }
          throw error
        }
      },
    },
  },
})
