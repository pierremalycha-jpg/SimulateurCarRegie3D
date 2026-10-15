// Visite du car : captures et test de déplacement (collisions, porte, ciblage des postes)
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/c77888a1-6f04-5876-a000-ab7e7f493575/scratchpad/truck';
fs.mkdirSync(OUT, { recursive: true });
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const three = fs.readFileSync('node_modules/three/build/three.module.min.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: three, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
await page.route('http://local.test/**', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
await page.goto('http://local.test/?' + (process.argv[3] || 'lite'));
await page.waitForTimeout(2500);
const ev = (f, a) => page.evaluate(f, a);
await ev(() => window.__dbg.start('standard', 'jour', 'basse', false));
await page.waitForTimeout(3000);
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('shot', n); };
// vues fixes
const views = JSON.parse(process.argv[4] || 'null') || [
  ['porte', -17.25, -117.6, 0, 0], ['prod', -20.8, -118.3, 0, -0.1], ['allee-vers-tech', -19, -119.2, -Math.PI / 2, 0],
  ['vision', -16, -118.6, 0, -0.1], ['tech', -12.8, -120, -Math.PI / 2, 0], ['son', -24.4, -119.5, Math.PI / 2, -0.1],
];
for (const [n, x, z, yaw, pitch] of views) {
  await ev(([x, z, yaw, pitch]) => { const d = window.__dbg; d.S.inTruck = true; d.PL.pos.set(x, 1.2, z); d.PL.yaw = yaw; d.PL.pitch = pitch; }, [x, z, yaw, pitch]);
  await page.waitForTimeout(1500);
  const p = await ev(() => document.querySelector('#prompt:not([hidden])')?.textContent || '-');
  console.log(n, 'prompt:', p);
  await shot('t-' + n);
}
// grand plan du car
await ev(() => { window.__dbg.emit && 0; document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' })); });
await page.keyboard.press('Tab'); await page.waitForTimeout(800); await shot('t-plan');
await page.locator('#modal button', { hasText: 'Baie CCU' }).click(); await page.waitForTimeout(1200);
console.log('after plan click', await ev(() => window.__dbg.S.mode), await ev(() => document.querySelector('#station .st-head h2, #station h2')?.textContent));
await shot('t-plan-goto');
console.log('ERRORS', errors.length, errors.slice(0, 5).join('\n'));
await browser.close();
