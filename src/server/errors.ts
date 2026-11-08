/** A server command refused; `code` tells the client why. */
export class CommandError extends Error {
  override name = "CommandError"

  constructor(readonly code: string) {
    super(code)
  }
}
