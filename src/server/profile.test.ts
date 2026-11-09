import { describe, expect, it } from "vitest"
import {
  getAvatar,
  getAvatarSource,
  getProfile,
  removeAvatar,
  setAvatar,
  setTheme,
  updateProfile,
} from "./profile"
import { avatar as avatarTable } from "./db/schema"
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
  const crop = { x: 0.1, y: 0.2, size: 0.5 }
  const picture = { avatar: png, source: webp, crop }

  it("is stored in the database and served to signed-in players", async () => {
    const app = await createTestApp()
    const anna = await signUp(app.auth, { username: "anna" })
    const ben = await signUp(app.auth, { username: "ben" })

    await setAvatar(app, anna.headers, picture)

    const image = (await getProfile(app, anna.headers)).image
    expect(image).toMatch(new RegExp(`^/api/avatar/${anna.user.id}\\?v=\\d+$`))
    expect(await getAvatar(app, ben.headers, anna.user.id)).toEqual({
      contentType: "image/png",
      data: png,
    })
  })

  it("keeps the source image and the crop so its owner can adjust it later", async () => {
    const app = await createTestApp()
    const { headers } = await signUp(app.auth, { username: "anna" })

    await setAvatar(app, headers, picture)

    expect(await getAvatarSource(app, headers)).toEqual({
      source: { contentType: "image/webp", data: webp },
      crop,
    })
  })

  it("replaces picture, source and crop together, so there is only ever one", async () => {
    const app = await createTestApp()
    const { user, headers } = await signUp(app.auth, { username: "anna" })
    await setAvatar(app, headers, picture)

    const newCrop = { x: 0, y: 0, size: 1 }
    await setAvatar(app, headers, { avatar: webp, source: png, crop: newCrop })

    expect(await getAvatar(app, headers, user.id)).toMatchObject({
      contentType: "image/webp",
    })
    expect(await getAvatarSource(app, headers)).toEqual({
      source: { contentType: "image/png", data: png },
      crop: newCrop,
    })
  })

  it("starts from the Google picture, uncropped, for an account that only has that", async () => {
    const app = await createTestApp()
    const { headers } = await signInWithGoogle(app.auth, {
      sub: "g-1",
      email: "ben@gmail.com",
      name: "Ben",
      picture: "https://lh3.googleusercontent.com/ben",
    })

    expect(await getAvatarSource(app, headers)).toEqual({
      source: { url: "https://lh3.googleusercontent.com/ben" },
      crop: { x: 0, y: 0, size: 1 },
    })
  })

  it("is nothing for someone who never set one", async () => {
    const app = await createTestApp()
    const { user, headers } = await signUp(app.auth, { username: "anna" })

    expect(await getAvatar(app, headers, user.id)).toBeNull()
    expect(await getAvatarSource(app, headers)).toBeNull()
  })

  it("can be removed, after which the profile shows the initial again", async () => {
    const app = await createTestApp()
    const { user, headers } = await signUp(app.auth, { username: "anna" })
    await setAvatar(app, headers, picture)

    await removeAvatar(app, headers)

    expect((await getProfile(app, headers)).image).toBeNull()
    expect(await getAvatar(app, headers, user.id)).toBeNull()
    expect(await getAvatarSource(app, headers)).toBeNull()
  })

  it("can be removed when it came from Google", async () => {
    const app = await createTestApp()
    const { headers } = await signInWithGoogle(app.auth, {
      sub: "g-1",
      email: "ben@gmail.com",
      name: "Ben",
      picture: "https://lh3.googleusercontent.com/ben",
    })

    await removeAvatar(app, headers)

    expect((await getProfile(app, headers)).image).toBeNull()
  })

  it("takes its type from the file's content", async () => {
    const app = await createTestApp()
    const { user, headers } = await signUp(app.auth, { username: "anna" })

    await setAvatar(app, headers, { ...picture, avatar: png })

    expect(await getAvatar(app, headers, user.id)).toMatchObject({
      contentType: "image/png",
    })
  })

  const html = new TextEncoder().encode("<script>alert(1)</script>")
  it.each([
    { case: "a picture that is not an image", avatar: html },
    {
      case: "a picture larger than 256 KB",
      avatar: new Uint8Array([...png, ...new Uint8Array(256 * 1024)]),
    },
    { case: "a source that is not an image", source: html },
    {
      case: "a source larger than 1 MB",
      source: new Uint8Array([...png, ...new Uint8Array(1024 * 1024)]),
    },
  ])("refuses $case", async (files) => {
    const app = await createTestApp()
    const { headers } = await signUp(app.auth, { username: "anna" })

    await expect(
      setAvatar(app, headers, { ...picture, ...files })
    ).rejects.toMatchObject({ code: "invalidImage" })
  })

  it("refuses crop data that is not a crop at all", async () => {
    const app = await createTestApp()
    const { headers } = await signUp(app.auth, { username: "anna" })

    await expect(
      setAvatar(app, headers, {
        ...picture,
        crop: null as unknown as typeof crop,
      })
    ).rejects.toMatchObject({ code: "invalidCrop" })
  })

  it("starts from the avatar itself, uncropped, for a picture stored before cropping existed", async () => {
    const app = await createTestApp()
    const { user, headers } = await signUp(app.auth, { username: "anna" })
    // Such rows only exist from before the source column; there is no
    // command that creates them any more.
    await app.db
      .insert(avatarTable)
      .values({ userId: user.id, contentType: "image/png", data: png })

    expect(await getAvatarSource(app, headers)).toEqual({
      source: { contentType: "image/png", data: png },
      crop: { x: 0, y: 0, size: 1 },
    })
  })

  it.each([
    { case: "outside the image", crop: { x: 1, y: 0, size: 0.5 } },
    { case: "larger than the image", crop: { x: 0, y: 0, size: 1.5 } },
    { case: "of no size", crop: { x: 0, y: 0, size: 0 } },
    { case: "negative", crop: { x: -0.1, y: 0, size: 0.5 } },
  ])("refuses a crop that is $case", async ({ crop: badCrop }) => {
    const app = await createTestApp()
    const { headers } = await signUp(app.auth, { username: "anna" })

    await expect(
      setAvatar(app, headers, { ...picture, crop: badCrop })
    ).rejects.toMatchObject({ code: "invalidCrop" })
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
      run: (app, headers) =>
        setAvatar(app, headers, {
          avatar: png,
          source: png,
          crop: { x: 0, y: 0, size: 1 },
        }),
    },
    { command: "getAvatarSource", run: getAvatarSource },
    { command: "removeAvatar", run: removeAvatar },
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
