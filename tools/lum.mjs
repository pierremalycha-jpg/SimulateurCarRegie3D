// Luminance moyenne des images caméra (sorties CCU) : compare rendu physique / rendu Lambert
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const three = fs.readFileSync('node_modules/three/build/three.module.min.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const L = process.argv[2] || 'jour';
for (const q of ['nopbr', '']) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: three, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
  await page.route('http://local.test/**', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
  await page.goto('http://local.test/?' + q);
  await page.waitForTimeout(2500);
  await page.evaluate((L) => window.__dbg.start('standard', L, 'basse', false), L);
  await page.waitForTimeout(9000);
  const res = await page.evaluate(() => {
    const D = window.__dbg; const r = D.renderer; const out = {};
    for (const c of D.S.cams.slice(0, 8)) {
      const rt = c.outRT; if (!rt) continue;
      const w = rt.width, h = rt.height; const buf = new Uint8Array(w * h * 4);
      r.readRenderTargetPixels(rt, 0, 0, w, h, buf);
      let s = 0, hi = 0; for (let i = 0; i < buf.length; i += 4) { const y = 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]; s += y; if (y > 250) hi++; }
      out['CAM' + c.id] = [(s / (w * h)).toFixed(1), (hi / (w * h) * 100).toFixed(1) + '%'];
    }
    return { pbr: D.RENDER.pbr, out };
  });
  console.log(q || 'pbr', JSON.stringify(res), 'errors', errors.length, errors.slice(0, 3).join(' | '));
  await page.close();
}
await browser.close();
