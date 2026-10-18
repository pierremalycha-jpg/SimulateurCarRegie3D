// Captures des synoptiques du car
// node tests/e2e/synoptiques.mjs [dossier] [sdi | ip | faults]
import { launch, openPage, outDir } from './harness.mjs';
import fs from 'fs';
const OUT = outDir('synoptiques');
const MODE = process.argv[3] || 'sdi';
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
const errors = [];
const page = await openPage(browser, { viewport: { width: 1500, height: 1000 }, errors });
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
process.exitCode = errors.length ? 1 : 0;
