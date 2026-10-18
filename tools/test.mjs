import { launch, openPage, outDir } from '../tests/e2e/harness.mjs';
const OUT = outDir('test');
const browser = await launch();
const errors = [];
const page = await openPage(browser, { viewport: { width: 1280, height: 800 }, errors });
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
