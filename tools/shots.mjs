// Captures d'écran de postes : node tools/shots.mjs OUT W H '["vision","hf"]'
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const [OUT, W, H, LIST] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const three = fs.readFileSync('node_modules/three/build/three.module.min.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, hasTouch: +W < 800, isMobile: +W < 800 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: three, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
await page.route('http://local.test/?lite', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
await page.goto('http://local.test/?lite');
await page.waitForTimeout(3000);
await page.evaluate(() => window.__dbg.start('standard', 'jour', 'basse', false));
await page.waitForTimeout(5000);
for (const item of JSON.parse(LIST)) {
  const [id, code] = Array.isArray(item) ? item : [item, null];
  await page.evaluate((id) => { window.__dbg.closeStation(); if (!id.startsWith('_')) window.__dbg.openStation(id); }, id);
  if (code) await page.evaluate(code);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/${id}.png` });
  console.log('shot', id);
}
console.log('ERRORS', errors.join('\n'));
await browser.close();
