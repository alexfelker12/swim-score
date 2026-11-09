/** German messages for better-auth error codes, by the field they belong to. */
export function authError(code: string | undefined): {
  field: "username" | "email" | "password" | "form"
  message: string
} {
  switch (code) {
    case "USERNAME_IS_ALREADY_TAKEN":
      return {
        field: "username",
        message: "Dieser Benutzername ist schon vergeben.",
      }
    case "USERNAME_TOO_SHORT":
      return { field: "username", message: "Mindestens 3 Zeichen." }
    case "USERNAME_TOO_LONG":
      return { field: "username", message: "Höchstens 30 Zeichen." }
    case "INVALID_USERNAME":
      return {
        field: "username",
        message: "Nur Buchstaben, Ziffern, Punkt und Unterstrich.",
      }
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return {
        field: "email",
        message: "Zu dieser E-Mail gibt es schon ein Konto.",
      }
    case "INVALID_EMAIL":
      return {
        field: "email",
        message: "Das ist keine gültige E-Mail-Adresse.",
      }
    case "PASSWORD_TOO_SHORT":
      return { field: "password", message: "Mindestens 8 Zeichen." }
    case "INVALID_USERNAME_OR_PASSWORD":
    case "INVALID_EMAIL_OR_PASSWORD":
      return {
        field: "password",
        message: "Benutzername oder Passwort stimmt nicht.",
      }
    case "account_not_linked":
      return {
        field: "form",
        message:
          "Zu dieser E-Mail gibt es schon ein Konto. Melde dich mit Benutzername und Passwort an.",
      }
    case "PROVIDER_NOT_FOUND":
      return {
        field: "form",
        message: "Die Anmeldung mit Google ist gerade nicht eingerichtet.",
      }
    default:
      return {
        field: "form",
        message: "Das hat nicht geklappt. Versuch es noch einmal.",
      }
  }
}
