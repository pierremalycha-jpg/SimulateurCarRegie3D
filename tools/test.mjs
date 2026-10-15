import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/c77888a1-6f04-5876-a000-ab7e7f493575/scratchpad/shots';
fs.mkdirSync(OUT, { recursive: true });
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const three = fs.readFileSync('node_modules/three/build/three.module.min.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + e.stack));
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: three, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
await page.route('http://local.test/?lite', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
await page.goto('http://local.test/?lite');
await page.waitForTimeout(4000);
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('shot', n); };
await shot('01-start');
const steps = JSON.parse(process.argv[3] || '[]');
try { await page.evaluate(() => window.__dbg.start('standard', 'jour', 'basse', false)); } catch (e) { console.log('ERRS', errors.join('\n')); throw e; }
await page.waitForTimeout(6000);
await shot('02-compound');
for (const [name, code, wait] of steps) {
  try { await page.evaluate(code); } catch (e) { errors.push('STEP ' + name + ': ' + e.message); }
  await page.waitForTimeout(wait || 3000);
  await shot(name);
}
const info = await page.evaluate(() => { const S = window.__dbg.S; return { fps: document.querySelector('#statusbar')?.innerText, cams: S.cams.map((c) => [c.id, c.status.ok, Math.round(c.meter.mean * 100), Math.round(c.meter.peak * 100), c.rf ? Math.round(c.rf.margin) : null]) }; });
console.log(JSON.stringify(info));
console.log('ERRORS:\n' + errors.slice(0, 40).join('\n'));
await browser.close();
