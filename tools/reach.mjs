// Accessibilité à pied de chaque poste du car (recherche de chemin sur la carte de collisions)
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const three = fs.readFileSync('node_modules/three/build/three.module.min.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: three, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
await page.route('https://fonts.**/**', (r) => r.abort());
await page.route('http://local.test/**', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
await page.goto('http://local.test/?lite'); await page.waitForTimeout(2500);
const res = await page.evaluate(() => {
  const d = window.__dbg, TR = d.TRUCK, R = 0.24, Dg = R * 0.71, step = 0.05;
  const blocked = (x, z) => d.truckBlocked(x, z);
  const ok = (x, z) => !blocked(x + R, z) && !blocked(x - R, z) && !blocked(x, z + R) && !blocked(x, z - R) && !blocked(x + Dg, z + Dg) && !blocked(x - Dg, z + Dg) && !blocked(x + Dg, z - Dg) && !blocked(x - Dg, z - Dg);
  const nx = Math.round(17.6 / step), nz = Math.round(5.4 / step);
  const key = (i, j) => i * 1000 + j;
  const toW = (i, j) => [TR.cx - 8.8 + i * step, TR.cz - 2.7 + j * step];
  // départ : juste à l'intérieur de la porte
  const sx = Math.round((TR.doorX0 + 0.5 - (TR.cx - 8.8)) / step), sz = Math.round((2.45) / step + 2.7 / step);
  const seen = new Set([key(sx, sz)]); const q = [[sx, sz]];
  while (q.length) { const [i, j] = q.shift(); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a > nx || b > nz) continue; const k = key(a, b); if (seen.has(k)) continue; const [x, z] = toW(a, b); if (!ok(x, z)) continue; seen.add(k); q.push([a, b]); } }
  const out = [];
  for (const s of d.T.stations) { const i = Math.round((s.pos.x - (TR.cx - 8.8)) / step), j = Math.round((s.pos.z - (TR.cz - 2.7)) / step); out.push([s.label, seen.has(key(i, j)) ? 'OK' : 'INACCESSIBLE', ok(s.pos.x, s.pos.z) ? '' : '(position bloquée)']); }
  return { start: ok(...toW(sx, sz)), cells: seen.size, out };
});
console.log(JSON.stringify(res, null, 1)); console.log('ERRORS', errors);
await browser.close();
