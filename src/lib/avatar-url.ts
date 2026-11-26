/**
 * The address of a profile picture in its large size, for the zoomed
 * picture (#62): an uploaded one with `size=large` (the server falls back to
 * the small one for pictures from before), a Google picture at 1024 px.
 */
export function largeAvatarUrl(image: string): string {
  if (image.startsWith("/api/avatar/")) {
    return `${image}${image.includes("?") ? "&" : "?"}size=large`
  }
  // Google pictures end in a size, such as "=s96-c".
  if (/^https:\/\/[^/]*googleusercontent\.com\//.test(image)) {
    return image.replace(/=s\d+(-c)?$/, "=s1024$1")
  }
  return image
}
