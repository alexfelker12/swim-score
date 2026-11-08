const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, projDir, outDir] = process.argv;
const fontDir = path.join(__dirname, 'node_modules/@fontsource');
const ff = [];
for (const w of [400, 500, 600, 700]) ff.push(`@font-face{font-family:'IBM Plex Sans';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(fontDir, 'ibm-plex-sans/files/ibm-plex-sans-latin-' + w + '-normal.woff2')).toString('base64')}) format('woff2')}`);
ff.push(`@font-face{font-family:'Google Sans';font-weight:500;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(fontDir, 'roboto/files/roboto-latin-500-normal.woff2')).toString('base64')}) format('woff2')}`);
const sources = {};
for (const f of fs.readdirSync(projDir)) if (f.endsWith('.dc.html')) sources[f.replace('.dc.html', '')] = fs.readFileSync(path.join(projDir, f), 'utf8');
const canvas = JSON.parse(fs.readFileSync(path.join(projDir, 'canvas.json'), 'utf8'));
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const errors = [];
  for (const file of canvas.order) {
    const b = canvas.boards[file]; if (!b) continue;
    const name = file.replace('.dc.html', ''); const props = JSON.parse(process.env.PROPS||'{}');
    if (only && !only.includes(name)) continue;
    const page = await browser.newPage({ viewport: { width: b.w, height: b.h }, deviceScaleFactor: 2 });
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
    await page.setContent(`<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${ff.join('')}body{margin:0}#host{width:${b.w}px;height:${b.h}px;overflow:hidden}</style></head><body><div id="host"></div></body></html>`);
    await page.evaluate(s => { window.__DC_SOURCES = s; }, sources);
    await page.addScriptTag({ path: path.join(__dirname, 'renderer.js') });
    try { await page.evaluate(([n, p]) => window.__renderDC(n, p), [name, props]); } catch (e) { errors.push(name + ': ' + e.message); }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(outDir, (process.env.OUTNAME||name) + '.png') });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, '_errors.txt'), errors.join('\n'));
  console.log('done', errors.length, 'errors');
})();
