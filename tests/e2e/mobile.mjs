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

// téléphone à forte densité (écran ×3, fenêtre 426 × 779) : le poste Vision et son instrument de
// mesure (tuiles très petites, vecteurscope) s'ouvrent sans erreur
await page.close();
const hd = await openPage(await launch(), { viewport: { width: 426, height: 779 }, mobile: true, dpr: 3, errors: T.errors });
await hd.evaluate(() => window.__dbg.start('standard', 'jour', 'moyenne', false, 'HD', false));
T.check('téléphone ×3 : partie lancée', await until(hd, () => window.__dbg.S.mode === 'fps'));
const e0 = T.errors.length;
await hd.evaluate(() => window.__dbg.openStation('vision'));
T.check('téléphone ×3 : poste Vision ouvert', await until(hd, () => window.__dbg.S.mode === 'station' && window.__dbg.S.station === 'vision', null, 30000));
await hd.waitForTimeout(4000);
await hd.setViewportSize({ width: 779, height: 426 }); await hd.waitForTimeout(1500); // bascule en paysage
await hd.setViewportSize({ width: 426, height: 779 }); await hd.waitForTimeout(1500);
await hd.screenshot({ path: OUT + '/m7-vision-x3.png' });
// tuiles écrasées à quelques pixels (comme dans l'application Claude sur Android) : chaque affichage
// de l'instrument se dessine sans erreur (le vecteurscope calculait un rayon négatif)
const apps = await hd.evaluate(() => [...document.querySelector('#station select.pz-app').options].map((o) => o.value));
for (const [cw, ch] of [[300, 8], [8, 200], [1, 1]]) {
  await hd.addStyleTag({ content: `.pz-tile canvas { width: ${cw}px !important; height: ${ch}px !important; min-height: 0 !important; }` });
  for (const a of apps) {
    await hd.evaluate((v) => { for (const s of document.querySelectorAll('#station select.pz-app')) { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); } }, a);
    await hd.waitForTimeout(300);
  }
}
T.check(`téléphone ×3 : poste Vision sans erreur, ${apps.length} affichages de mesure sur tuiles minuscules`, T.errors.length === e0, T.errors.slice(e0).join(' | ').slice(0, 300));
await T.finish();
