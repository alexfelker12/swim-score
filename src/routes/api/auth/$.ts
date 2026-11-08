import { createFileRoute } from "@tanstack/react-router"
import { getApp } from "@/server/instance"

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => getApp().auth.handler(request),
      POST: ({ request }) => getApp().auth.handler(request),
    },
  },
})
