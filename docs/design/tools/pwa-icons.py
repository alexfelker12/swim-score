# Erzeugt Favicon, PWA-Icons, Apple-Touch-Icon und iOS-Splash-Screens aus dem App-Zeichen.
# Aufruf: python3 docs/design/tools/pwa-icons.py <ziel>  (braucht rsvg-convert und ImageMagick)
import json, os, subprocess, sys
OUT = sys.argv[1]
PR, ONPR, BG = "#5CC2D6", "#062A31", "#131517"
W1 = "M6 11.5c1.4 0 2.1-1.5 4-1.5s2.6 1.5 4 1.5 2.1-1.5 4-1.5 2.6 1.5 4 1.5"
W2 = "M6 17c1.4 0 2.1-1.5 4-1.5s2.6 1.5 4 1.5 2.1-1.5 4-1.5 2.6 1.5 4 1.5"

def waves(color, scale=1.0, mono=False):
    # Scale around the centre of the 28x28 box.
    t = f'translate(14 14) scale({scale}) translate(-14 -14)'
    o2 = 1 if mono else .55
    return (f'<g transform="{t}" fill="none" stroke="{color}" stroke-width="2.2" stroke-linecap="round">'
            f'<path d="{W1}"/><path d="{W2}" opacity="{o2}"/></g>')

def svg(body, w=28, h=28, vb="0 0 28 28"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}">{body}</svg>'

rounded   = svg(f'<rect width="28" height="28" rx="8" fill="{PR}"/>' + waves(ONPR))
fullbleed = svg(f'<rect width="28" height="28" fill="{PR}"/>' + waves(ONPR))             # iOS rounds itself
maskable  = svg(f'<rect width="28" height="28" fill="{PR}"/>' + waves(ONPR, .85))        # inside 80 % safe zone
mono      = svg(waves("#FFFFFF", .85, mono=True))                                         # Android themed icon

def png(src, size, path, w=None, h=None):
    tmp = "/tmp/_icon.svg"; open(tmp, "w").write(src)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(["rsvg-convert", "-w", str(w or size), "-h", str(h or size), tmp, "-o", path], check=True)

os.makedirs(f"{OUT}/public/icons", exist_ok=True)
open(f"{OUT}/public/favicon.svg", "w").write(rounded.replace('width="28" height="28" viewBox', 'viewBox', 1))
png(rounded, 192, f"{OUT}/public/icons/icon-192.png")
png(rounded, 512, f"{OUT}/public/icons/icon-512.png")
png(maskable, 192, f"{OUT}/public/icons/icon-maskable-192.png")
png(maskable, 512, f"{OUT}/public/icons/icon-maskable-512.png")
png(mono, 512, f"{OUT}/public/icons/icon-monochrome-512.png")
png(fullbleed, 180, f"{OUT}/public/apple-touch-icon.png")
for s in (16, 32, 48): png(rounded, s, f"/tmp/fav{s}.png")
subprocess.run(["convert", "/tmp/fav16.png", "/tmp/fav32.png", "/tmp/fav48.png", f"{OUT}/public/favicon.ico"], check=True)

# iOS splash screens (portrait, iPhones only - the app is mobile only)
DEVICES = [  # css w, css h, dpr
    (440, 956, 3), (420, 912, 3), (402, 874, 3), (430, 932, 3), (393, 852, 3), (428, 926, 3),
    (390, 844, 3), (360, 780, 3), (375, 812, 3), (414, 896, 3), (414, 896, 2), (414, 736, 3),
    (375, 667, 2), (320, 568, 2),
]
links = []
for cw, ch, dpr in DEVICES:
    pw, ph = cw * dpr, ch * dpr
    icon = 96  # css px, centred
    s = icon / 28
    body = (f'<rect width="{cw}" height="{ch}" fill="{BG}"/>'
            f'<g transform="translate({(cw-icon)/2} {(ch-icon)/2}) scale({s})">'
            f'<rect width="28" height="28" rx="8" fill="{PR}"/>{waves(ONPR)}</g>')
    name = f"splash-{pw}x{ph}.png"
    png(svg(body, cw, ch, f"0 0 {cw} {ch}"), 0, f"{OUT}/public/splash/{name}", pw, ph)
    links.append({"rel": "apple-touch-startup-image", "href": f"/splash/{name}",
                  "media": f"(device-width: {cw}px) and (device-height: {ch}px) and (-webkit-device-pixel-ratio: {dpr}) and (orientation: portrait)"})

manifest = {
    "id": "/", "name": "Swim Score", "short_name": "Swim Score",
    "description": "Schwimmen mitzählen, Ranglisten für eure Runde.",
    "lang": "de", "start_url": "/", "scope": "/",
    "display": "standalone", "orientation": "portrait",
    "theme_color": BG, "background_color": BG,
    "icons": [
        {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
        {"src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        {"src": "/icons/icon-monochrome-512.png", "sizes": "512x512", "type": "image/png", "purpose": "monochrome"},
    ],
}
open(f"{OUT}/public/manifest.json", "w").write(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
json.dump(links, open("/tmp/splash-links.json", "w"))
