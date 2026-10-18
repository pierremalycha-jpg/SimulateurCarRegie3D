import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('mobile');
// node tests/e2e/mobile.mjs [dossier] [ip]
const IP = process.argv[3] === 'ip';
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { viewport: { width: 400, height: 820 }, mobile: true, errors: T.errors });
const noScroll = async (what) => { const [doc, el] = await page.evaluate((s) => [document.documentElement.scrollWidth, document.querySelector(s)?.scrollWidth || 0], what); T.check(`pas de défilement horizontal (${what})`, doc <= 400 && el <= 400, `${doc} / ${el}`); };
await page.screenshot({ path: OUT + '/m1-start.png' });
await noScroll('#start');
await page.evaluate((ip) => window.__dbg.start('standard', 'jour', 'basse', false, 'HD', ip), IP);
T.check('partie lancée', await until(page, () => window.__dbg.S.mode === 'fps'));
await page.screenshot({ path: OUT + '/m2-fps.png' });
await page.evaluate(() => { window.__dbg.teleport(1); window.__dbg.openStation('melangeur'); });
await page.waitForTimeout(3000);
await page.screenshot({ path: OUT + '/m3-mixer.png' });
await noScroll('#station');
if (IP) {
  await page.evaluate(() => { window.__dbg.closeStation(); window.__dbg.openStation('reseau'); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '/m5-reseau.png' });
  await noScroll('#station');
  await page.locator('#station .tabs .tab[data-k="switch"]').click(); await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/m6-reseau-switch.png' });
  await noScroll('#station');
}
await page.evaluate(() => { window.__dbg.closeStation(); window.__dbg.openPlan(); });
await page.waitForTimeout(3000);
await page.screenshot({ path: OUT + '/m4-plan.png' });
await T.finish();
