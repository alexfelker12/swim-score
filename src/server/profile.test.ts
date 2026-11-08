import { describe, expect, it } from "vitest"
import {
  getAvatar,
  getProfile,
  setAvatar,
  setTheme,
  updateProfile,
} from "./profile"
import { createTestApp, signInWithGoogle, signUp } from "./testing/test-app"

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
// "RIFF", size, "WEBP"
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1,
])

describe("the profile", () => {
  it("shows display name, username as typed, e-mail and the dark theme by default", async () => {
    const app = await createTestApp()
    const { headers } = await signUp(app.auth, { username: "Anna" })

    expect(await getProfile(app, headers)).toEqual({
      id: expect.any(String),
      name: "Anna",
      username: "Anna",
      email: "anna@example.com",
      image: null,
      theme: "dark",
    })
  })

  it("lets the person change their display name", async () => {
    const app = await createTestApp()
    const { headers } = await signUp(app.auth, { username: "anna" })

    await updateProfile(app, headers, { name: "  Anna K.  " })

    expect((await getProfile(app, headers)).name).toBe("Anna K.")
  })

  it.each([
    { case: "empty", name: "   " },
    { case: "longer than 30 characters", name: "x".repeat(31) },
  ])("refuses a display name that is $case", async ({ name }) => {
    const app = await createTestApp()
    const { headers } = await signUp(app.auth, { username: "anna" })

    await expect(updateProfile(app, headers, { name })).rejects.toMatchObject({
      code: "invalidName",
    })
  })

  it("lets the person change their e-mail address", async () => {
    const app = await createTestApp()
    const { headers } = await signUp(app.auth, { username: "anna" })

    await updateProfile(app, headers, {
      name: "Anna",
      email: " Anna@Beispiel.de ",
    })

    expect((await getProfile(app, headers)).email).toBe("anna@beispiel.de")
  })

  it("refuses an e-mail address that another account uses", async () => {
    const app = await createTestApp()
    await signUp(app.auth, { username: "ben", email: "ben@example.com" })
    const { headers } = await signUp(app.auth, { username: "anna" })

    await expect(
      updateProfile(app, headers, { name: "Anna", email: "BEN@example.com" })
    ).rejects.toMatchObject({ code: "emailTaken" })
  })

  it("no longer counts a changed e-mail address as confirmed, so a Google account with that address is not linked to it", async () => {
    const app = await createTestApp()
    const mallory = await signInWithGoogle(app.auth, {
      sub: "g-mallory",
      email: "mallory@gmail.com",
      name: "Mallory",
    })
    await updateProfile(app, mallory.headers, {
      name: "Mallory",
      email: "victim@gmail.com",
    })

    await expect(
      signInWithGoogle(app.auth, {
        sub: "g-victim",
        email: "victim@gmail.com",
        name: "Victim",
      })
    ).rejects.toBeDefined()
  })

  it("refuses something that is not an e-mail address", async () => {
    const app = await createTestApp()
    const { headers } = await signUp(app.auth, { username: "anna" })

    await expect(
      updateProfile(app, headers, { name: "Anna", email: "anna" })
    ).rejects.toMatchObject({ code: "invalidEmail" })
  })

  it("lets the person choose a theme", async () => {
    const app = await createTestApp()
    const { headers } = await signUp(app.auth, { username: "anna" })

    await setTheme(app, headers, { theme: "system" })

    expect((await getProfile(app, headers)).theme).toBe("system")
  })
})

describe("the profile picture", () => {
  it("is stored in the database and served to signed-in players", async () => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "anna" })
    const ben = await signUp(app.auth, { username: "ben" })

    await setAvatar(app, anna.headers, { data: png })

    const image = (await getProfile(app, anna.headers)).image
    expect(image).toMatch(new RegExp(`^/api/avatar/${anna.user.id}\\?v=\\d+$`))
    expect(await getAvatar(app, ben.headers, anna.user.id)).toEqual({
      contentType: "image/png",
      data: png,
    })
  })

  it("replaces an earlier picture, including one from Google", async () => {
    const app = await createTestApp()
    const { user, headers } = await signInWithGoogle(app.auth, {
      sub: "g-1",
      email: "ben@gmail.com",
      name: "Ben",
      picture: "https://lh3.googleusercontent.com/ben",
    })
    expect((await getProfile(app, headers)).image).toBe(
      "https://lh3.googleusercontent.com/ben"
    )

    await setAvatar(app, headers, { data: png })
    await setAvatar(app, headers, { data: webp })

    expect(await getAvatar(app, headers, user.id)).toEqual({
      contentType: "image/webp",
      data: webp,
    })
  })

  it("is nothing for someone who never uploaded one", async () => {
    const app = await createTestApp()
    const { user, headers } = await signUp(app.auth, { username: "anna" })

    expect(await getAvatar(app, headers, user.id)).toBeNull()
  })

  it("takes its type from the file's content", async () => {
    const app = await createTestApp()
    const { user, headers } = await signUp(app.auth, { username: "anna" })

    await setAvatar(app, headers, { data: png })

    expect(await getAvatar(app, headers, user.id)).toMatchObject({
      contentType: "image/png",
    })
  })

  it.each([
    {
      case: "not an image",
      data: new TextEncoder().encode("<script>alert(1)</script>"),
    },
    {
      case: "larger than 256 KB",
      data: new Uint8Array([...png, ...new Uint8Array(256 * 1024)]),
    },
  ])("refuses a file that is $case", async ({ data }) => {
    const app = await createTestApp()
    const { headers } = await signUp(app.auth, { username: "anna" })

    await expect(setAvatar(app, headers, { data })).rejects.toMatchObject({
      code: "invalidImage",
    })
  })
})

describe("every profile command", () => {
  it.each([
    { command: "getProfile", run: getProfile },
    {
      command: "updateProfile",
      run: (app, headers) => updateProfile(app, headers, { name: "X" }),
    },
    {
      command: "setTheme",
      run: (app, headers) => setTheme(app, headers, { theme: "light" }),
    },
    {
      command: "setAvatar",
      run: (app, headers) => setAvatar(app, headers, { data: png }),
    },
    {
      command: "getAvatar",
      run: (app, headers) => getAvatar(app, headers, "u"),
    },
  ] satisfies Array<{
    command: string
    run: (
      app: Awaited<ReturnType<typeof createTestApp>>,
      headers: Headers
    ) => Promise<unknown>
  }>)("rejects $command without a signed-in session", async ({ run }) => {
    const app = await createTestApp()

    await expect(run(app, new Headers())).rejects.toMatchObject({
      code: "notSignedIn",
    })
  })
})
