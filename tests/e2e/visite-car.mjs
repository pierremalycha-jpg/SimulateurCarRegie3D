// Visite du car : captures et test de déplacement (collisions, porte, ciblage des postes)
// node tests/e2e/visite-car.mjs [dossier] [requête] [vues en JSON]
import { launch, openPage, outDir } from './harness.mjs';
const OUT = outDir('visite-car');
const browser = await launch();
const errors = [];
const page = await openPage(browser, { viewport: { width: 1280, height: 760 }, query: (process.argv[3] || 'lite'), errors });
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
process.exitCode = errors.length ? 1 : 0;
