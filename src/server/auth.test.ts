import { describe, expect, it } from "vitest"
import { createTestApp, signInWithGoogle, signUp } from "./testing/test-app"

describe("signing up with username and password", () => {
  it("lets the person sign in with that username afterwards", async () => {
    const { auth } = await createTestApp()

    await signUp(auth, { username: "Anna" })
    const signedIn = await auth.api.signInUsername({
      body: { username: "anna", password: "geheim123" },
    })

    expect(signedIn.user).toMatchObject({
      username: "anna",
      displayUsername: "Anna",
      name: "Anna",
    })
  })

  it("refuses a username that is taken, whatever its case", async () => {
    const { auth } = await createTestApp()
    await signUp(auth, { username: "anna" })

    await expect(
      signUp(auth, { username: "ANNA", email: "other@example.com" })
    ).rejects.toMatchObject({ body: { code: "USERNAME_IS_ALREADY_TAKEN" } })
  })

  it("refuses a password shorter than 8 characters", async () => {
    const { auth } = await createTestApp()

    await expect(
      signUp(auth, { username: "anna", password: "kurz123" })
    ).rejects.toMatchObject({ body: { code: "PASSWORD_TOO_SHORT" } })
  })

  it("does not let anyone change the username later", async () => {
    const { auth } = await createTestApp()
    const { headers } = await signUp(auth, { username: "anna" })

    await expect(
      auth.api.updateUser({ headers, body: { username: "anna2" } })
    ).rejects.toMatchObject({ body: { code: "USERNAME_IS_IMMUTABLE" } })
  })
})

describe("signing up with Google", () => {
  it("derives the username from the e-mail address and takes the name from Google", async () => {
    const { auth } = await createTestApp()

    const { user } = await signInWithGoogle(auth, {
      sub: "g-1",
      email: "Ben.Mueller@gmail.com",
      name: "Ben Müller",
    })

    expect(user).toMatchObject({ username: "ben.mueller", name: "Ben Müller" })
  })

  it("appends a number when the derived username is taken", async () => {
    const { auth } = await createTestApp()
    await signUp(auth, { username: "ben" })

    const { user } = await signInWithGoogle(auth, {
      sub: "g-1",
      email: "ben@gmail.com",
      name: "Ben",
    })

    expect(user.username).toBe("ben2")
  })

  it("signs the same Google account into the same user next time", async () => {
    const { auth } = await createTestApp()
    const profile = { sub: "g-1", email: "ben@gmail.com", name: "Ben" }

    const first = await signInWithGoogle(auth, profile)
    const second = await signInWithGoogle(auth, profile)

    expect(second.user.id).toBe(first.user.id)
    expect(second.user.username).toBe("ben")
  })
})
