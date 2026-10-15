// Captures des synoptiques du car
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/c77888a1-6f04-5876-a000-ab7e7f493575/scratchpad/syn';
const MODE = process.argv[3] || 'sdi';
fs.mkdirSync(OUT, { recursive: true });
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const three = fs.readFileSync('node_modules/three/build/three.module.min.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message + '\n' + e.stack)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: three, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
await page.route('https://fonts.**/**', (r) => r.abort());
await page.route('http://local.test/**', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
await page.goto('http://local.test/?lite'); await page.waitForTimeout(2500);
await page.evaluate((m) => window.__dbg.start('standard', 'jour', 'basse', false, m === 'ip' ? 'UHD' : 'HD', m === 'ip'), MODE);
await page.evaluate(() => { window.__dbg.EX && (window.__dbg.EX.director = false); });
await page.waitForTimeout(4000);
if (MODE === 'faults') await page.evaluate(() => { const d = window.__dbg; d.injectFault('fibre'); d.injectFault('emb'); d.S.faults.gps = true; });
if (MODE === 'ip') await page.evaluate(() => { window.__dbg.injectFault('ipred'); window.__dbg.injectFault('ipgm'); });
await page.waitForTimeout(800);
await page.keyboard.press('KeyY'); await page.waitForTimeout(800);
for (const k of ['video', 'sync', 'audio', 'comms', 'net', 'power', 'racks', 'plan']) {
  await page.locator(`#modal .tab[data-k="${k}"]`).click(); await page.waitForTimeout(500);
  const svg = page.locator('#modal .synwrap');
  await svg.screenshot({ path: `${OUT}/${MODE}-${k}.png` });
  console.log('shot', k, await page.evaluate(() => document.querySelectorAll('#modal .synwrap svg .bx').length));
}
await page.locator('#modal button', { hasText: 'Fond blanc' }).click(); await page.waitForTimeout(400);
await page.locator('#modal .tab[data-k="video"]').click(); await page.waitForTimeout(400);
await page.locator('#modal .synwrap').screenshot({ path: `${OUT}/${MODE}-video-paper.png` });
// clic sur un bloc -> visionneuse
await page.evaluate(() => document.querySelector('#modal .synwrap svg [data-dev="mixer"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await page.waitForTimeout(600);
console.log('after click modal title', await page.evaluate(() => document.querySelector('#modal h2')?.textContent));
console.log('ERRORS', errors.length, errors.slice(0, 5).join('\n'));
await browser.close();
