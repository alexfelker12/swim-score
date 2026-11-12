import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { createPusher, readPresenceWebhook } from "./pusher"

const config = { appId: "1", key: "key", secret: "secret", cluster: "eu" }
const pusher = createPusher(config)

/** A webhook as Pusher sends it, signed with `secret`. */
function webhook(body: object, secret = config.secret) {
  const rawBody = JSON.stringify(body)
  const headers = new Headers({
    "content-type": "application/json",
    "x-pusher-key": config.key,
    "x-pusher-signature": createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex"),
  })
  return { headers, rawBody }
}

describe("Pusher's presence webhook", () => {
  it("reports devices joining and leaving Games' presence channels, at the webhook's time", () => {
    const { headers, rawBody } = webhook({
      time_ms: Date.UTC(2026, 10, 12, 20, 0),
      events: [
        { name: "member_added", channel: "presence-game-g1", user_id: "u1" },
        { name: "member_removed", channel: "presence-game-g1", user_id: "u2" },
      ],
    })

    expect(readPresenceWebhook(pusher, headers, rawBody)).toEqual([
      {
        gameId: "g1",
        userId: "u1",
        connected: true,
        at: new Date(Date.UTC(2026, 10, 12, 20, 0)),
      },
      {
        gameId: "g1",
        userId: "u2",
        connected: false,
        at: new Date(Date.UTC(2026, 10, 12, 20, 0)),
      },
    ])
  })

  it("leaves out other events and channels", () => {
    const { headers, rawBody } = webhook({
      time_ms: 0,
      events: [
        { name: "channel_occupied", channel: "presence-game-g1" },
        { name: "member_added", channel: "game-g1", user_id: "u1" },
        { name: "member_added", channel: "presence-other", user_id: "u1" },
      ],
    })

    expect(readPresenceWebhook(pusher, headers, rawBody)).toEqual([])
  })

  it("is refused when the signature is not Pusher's", () => {
    const { headers, rawBody } = webhook(
      {
        time_ms: 0,
        events: [
          {
            name: "member_removed",
            channel: "presence-game-g1",
            user_id: "u1",
          },
        ],
      },
      "guessed"
    )

    expect(readPresenceWebhook(pusher, headers, rawBody)).toBeNull()
  })
})
