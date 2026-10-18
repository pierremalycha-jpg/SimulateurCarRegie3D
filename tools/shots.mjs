// Captures d'écran de postes : node tools/shots.mjs OUT W H '["vision","hf"]'
import { launch, openPage } from '../tests/e2e/harness.mjs';
import fs from 'fs';
const [OUT, W, H, LIST, MODE] = process.argv.slice(2);
const Q = MODE === 'full' ? 'full' : 'lite';
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
const errors = [];
const page = await openPage(browser, { viewport: { width: +W, height: +H }, query: Q, mobile: +W < 800, errors });
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
