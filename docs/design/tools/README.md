# Screens neu rendern

Erzeugt `../screens/*.png` aus `../source/*.dc.html`. Das ist nötig, wenn die Design-Quellen geändert wurden, z. B. nach einem neuen Export aus dem Canvas.

```bash
cd docs/design/tools
npm i --no-save playwright @fontsource/ibm-plex-sans@5.1.1 @fontsource/roboto@5.1.1
npx playwright install chromium   # falls noch kein Chromium da ist
node render-screens.js ../source ../screens
```

Optional:
- `ONLY=i13-rangliste,i05-runde-1` rendert nur diese Screens.
- `PROPS='{"dialog":"entfernen"}' OUTNAME=i12-spieler-entfernen ONLY=i12-verwaltung` rendert einen Screen mit eigenen Props unter eigenem Namen.

`renderer.js` versteht genau die Teile des Formats, die die Quellen nutzen: Holes, `sc-if`, `sc-for`, `dc-import` und Props-Defaults. Events werden ignoriert. Fehler stehen in `../screens/_errors.txt`, diese Datei nicht committen.
