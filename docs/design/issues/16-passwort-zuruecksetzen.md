# #16 Passwort zurücksetzen: Design

> Teil von [`docs/design`](../README.md). Bei Widerspruch gilt [`decisions.md`](../decisions.md). Farben und Maße: [`tokens.css`](../tokens.css). Die Quellen zu lesen erklärt [`source/FORMAT.md`](../source/FORMAT.md).

## Screens

| Bild | Quelle | Zustand |
|---|---|---|
| [`i03-anmelden.png`](../screens/i03-anmelden.png) | [`i03-anmelden`](../source/i03-anmelden.dc.html) | Einstieg „Passwort vergessen?“ unter dem Passwortfeld |
| [`i16-passwort-vergessen.png`](../screens/i16-passwort-vergessen.png) | [`i03-anmelden`](../source/i03-anmelden.dc.html) | Passwort vergessen |
| [`i16-neues-passwort.png`](../screens/i16-neues-passwort.png) | [`i03-anmelden`](../source/i03-anmelden.dc.html) | Neues Passwort setzen (mit Fehler) |

## Verhalten und Texte

- **Ablauf:** Anmelden → „Passwort vergessen?“ → E-Mail → Link in der Mail öffnet „Neues Passwort“ → nach dem Speichern zurück zu „Anmelden“.
- **Passwort vergessen:**
  - Text „Gib die E-Mail-Adresse deines Kontos ein. Wir schicken dir einen Link, mit dem du ein neues Passwort setzt.“, Feld „E-Mail“, Button „Link senden“.
  - Danach immer, also ohne Auskunft, ob die Adresse existiert: „Wenn es zu dieser Adresse ein Konto gibt, ist der Link unterwegs. Er gilt eine Stunde und führt zu ‚Neues Passwort‘. Schau auch im Spam-Ordner nach.“
- **Neues Passwort:**
  - „Für das Konto anna. Danach meldest du dich damit an.“
  - Felder „Neues Passwort“ („Mindestens 8 Zeichen.“) und „Passwort bestätigen“, beide mit Augen-Schalter.
  - Fehler am Feld: „Die beiden Passwörter sind nicht gleich.“ Button „Passwort speichern“.
- **Abgelaufener Link:** nicht eigens entworfen. Muster wie `i11-einladung-ungueltig` (Icon links neben der Überschrift, Erklärung, Button „Neuen Link anfordern“).
