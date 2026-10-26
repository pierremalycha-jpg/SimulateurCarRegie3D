// Le poste vision en 3D (src/poste3d/rcp.js, src/poste3d/vision.js) : la rangée de RCP sur le bureau vision,
// un clic donne la main à un RCP, ses commandes (touches, molettes, joystick, bague, écran tactile) agissent sur
// la caméra par les mêmes gestes qu'en 2D (RCPACT) ; « Tous les réglages » contient le poste à plat (RCP, PRISM),
// ses moniteurs recopiés ; le parcours « Exposer une caméra au RCP » vise les commandes 3D.
// Les captures servent à relire l'écran : les regarder.
// node tests/e2e/poste3d-vision.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('poste3d-vision');
const T = reporter();
const browser = await launch();
// qualité Basse (le rendu logiciel des tests est lent) avec la vue 3D choisie
const page = await openPage(browser, { errors: T.errors, query: 'full', viewport: { width: 1280, height: 760 }, before: (p) => p.addInitScript(() => { try { localStorage.setItem('carregie.poste3d', '3d'); } catch (e) { /* stockage indisponible */ } }) });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n, w = 2000) => { await page.waitForTimeout(w); await page.screenshot({ path: `${OUT}/${n}.png` }); };
const view = async (v) => { await page.click(`.p3d-views [data-view="${v}"]`); await until(page, () => !window.__dbg.poste3d.P3D.fly, null, 20000); };
const cam = () => ev(() => { const d = window.__dbg; const c = d.S.cams.find((x) => x.id === d.S.selCam); return c ? { id: c.id, iris: c.paint.iris, bars: !!c.paint.bars, wbR: c.paint.wbR, active: c.panelActive !== false, mblack: c.paint.mblack } : null; });

await ev(() => window.__dbg.start('standard', 'jour', 'basse', false));
await until(page, () => window.__dbg.S.mode === 'fps', null, 30000);

T.check('la rangée de RCP est en 3D sur le bureau vision : boîtiers en matière, 16 RCP, touches instanciées (plus de 300), molettes et joysticks', await ev(() => {
  const n = new Map(); window.__dbg.T.scene.traverse((o) => { if (o.name && o.name.startsWith('pupitres-rcp')) n.set(o.name, o); });
  const keys = n.get('pupitres-rcp-touches-dessus');
  return !!n.get('pupitres-rcp-boitiers')?.material.userData.tri && !!keys && keys.count > 300 && n.get('pupitres-rcp-molettes')?.count === 96 && n.get('pupitres-rcp-joysticks')?.count === 16;
}));

await ev(() => { const d = window.__dbg; d.goToStation(d.T.stations.find((x) => x.id === 'vision1'), true); });
T.check('poste vision 1 ouvert en vue 3D : le RCP de la CAM 1 a la main', await until(page, () => window.__dbg.poste3d.P3D.active && window.__dbg.S.selCam === 1 && document.getElementById('station').classList.contains('p3d-on'), null, 90000));
T.check('écran partagé : à droite, le Grade 1, le multiview et le PRISM (waveform, vecteurscope) en direct, recopiés du rendu WebGL', await until(page, () => { const m = document.querySelector('.p3d-side .p3d-mons'); return !!m && !!m.querySelector('[data-gl="AUX_VISION"]') && !!m.querySelector('[data-gl="mv"]') && !!m.querySelector('.vision-prism .prism') && [...m.querySelectorAll('canvas.p3d-mirror')].filter((c) => c.width > 50).length >= 2; }, null, 60000));
T.check('une zone pour chaque autre RCP équipé (11 caméras) et, sur le RCP choisi, 10 touches de fonction, 9 touches assignables, 6 molettes, le joystick et sa bague', await ev(() => document.querySelectorAll('.p3d-rcpunit').length === 11 && document.querySelectorAll('.p3d-hit.rcp-btn').length === 10 && document.querySelectorAll('.p3d-hit.rcp-key').length === 9 && document.querySelectorAll('.p3d-hit.p3d-knob').length === 7 && !!document.querySelector('.p3d-hit.rjoy .rjoy-handle')));
await shot('01-poste');

await page.locator('.p3d-rcpunit', { hasText: 'CAM 2' }).click();
T.check('clic sur le RCP de la CAM 2 : il prend la main, le moniteur de référence suit, les commandes se reconstruisent', await until(page, () => window.__dbg.S.selCam === 2 && window.__dbg.ROUTER.map.AUX_VISION === 'CAM2' && document.querySelectorAll('.p3d-rcpunit').length === 11, null, 8000));
await view('rcp');
await page.locator('.p3d-hit.rcp-btn', { hasText: 'PANEL ACTIVE' }).click();
T.check('PANEL ACTIVE éteint : le RCP verrouille la caméra', await until(page, () => window.__dbg.S.cams.find((c) => c.id === 2).panelActive === false, null, 5000));
const iris0 = (await cam()).iris;
const jb = await page.locator('.p3d-hit.rjoy').boundingBox();
await page.mouse.move(jb.x + jb.width / 2, jb.y + jb.height / 2); await page.mouse.down(); await page.mouse.move(jb.x + jb.width / 2, jb.y, { steps: 4 }); await page.mouse.up();
T.check('verrouillé : le joystick ne change pas l\'iris (Réglage refusé)', Math.abs((await cam()).iris - iris0) < 1e-6 && await until(page, () => /PANEL ACTIVE est éteint/.test(document.querySelector('.p3d-side .explain')?.textContent || ''), null, 5000));
await page.locator('.p3d-hit.rcp-btn', { hasText: 'PANEL ACTIVE' }).click();
await page.mouse.move(jb.x + jb.width / 2, jb.y + jb.height / 2); await page.mouse.down(); await page.mouse.move(jb.x + jb.width / 2, jb.y - 40, { steps: 5 }); await page.mouse.up();
T.check('joystick poussé : l\'iris s\'ouvre, le fil l\'explique en diaphragmes', await until(page, () => { const c = window.__dbg.S.cams.find((x) => x.id === 2); return c.paint.iris < 5 && /Iris F/.test(document.querySelector('.p3d-side .explain')?.textContent || ''); }, null, 5000), JSON.stringify([iris0, (await cam()).iris]));
await page.locator('.p3d-hit.rcp-btn', { hasText: 'BARS' }).click();
T.check('BARS : la caméra envoie ses barres', await until(page, () => !!window.__dbg.S.cams.find((c) => c.id === 2).paint.bars, null, 5000));
const kb = await page.locator('.p3d-knob[aria-label="WHITE R"]').boundingBox();
await page.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2); await page.mouse.down(); await page.mouse.move(kb.x + kb.width / 2, kb.y - 30, { steps: 4 }); await page.mouse.up();
T.check('molette WHITE R glissée vers le haut : le gain rouge monte', (await cam()).wbR > 0);
await page.hover('.p3d-knob[aria-label="WHITE R"]');
T.check('survol : la bulle nomme la molette et dit son rôle', await until(page, () => { const t = document.querySelector('.p3d-tip'); return t && !t.hidden && /WHITE R/.test(t.textContent) && /blancs/.test(t.textContent); }, null, 5000));
await shot('02-rcp', 1200);
await page.click('.p3d-hit.p3d-lcd');
T.check('écran tactile : ses pages en 2D sur la fiche (PAINT, GAMMA / KNEE…) avec leurs molettes', await until(page, () => document.querySelectorAll('.p3d-fiche .rcp-tab').length === 4 && document.querySelectorAll('.p3d-fiche .rcp-encs .rot').length >= 3, null, 5000));
await shot('03-ecran-tactile', 1200);

await page.click('.p3d-drawer-btn');
T.check('« Tous les réglages » : le poste à plat (RCP de la CAM 2, matching) dans le tiroir ; les écrans restent dans le panneau', await until(page, () => { const d = document.querySelector('.p3d-drawer'); return d && !d.hidden && !!d.querySelector('.rcp') && /RCP 2/.test(d.textContent) && /matching/.test(d.textContent) && !d.querySelector('.vision-prism'); }, null, 8000));
await shot('04-tiroir', 2000);
await page.click('.p3d-drawer-btn');

// ---------------- le chef de car : « Exposer une caméra au RCP » ----------------
await view('poste');
await ev(() => { window.__dbg.toggleChef(true); window.__dbg.startChefLesson('vision-exposition'); });
await until(page, () => window.__dbg.TUTOR.lesson?.id === 'vision-exposition', null, 8000);
const stepId = () => ev(() => { const U = window.__dbg.TUTOR; return U.lesson ? U.lesson.steps[U.i].id : null; });
for (let k = 0; k < 4 && (await stepId()) !== 'active'; k++) { await ev(() => window.__dbg.chefDoForMe()); await page.waitForTimeout(1500); await ev(() => window.__dbg.chefNext()); }
const spotOn = (sel) => until(page, (sel) => { const s = document.getElementById('chef-spot'); if (!s || s.hidden) return false; const r = s.getBoundingClientRect(); return [...document.querySelectorAll(sel)].some((x) => { const q = x.getBoundingClientRect(); return q.width > 0 && Math.abs(q.left - r.left - 5) < 4 && Math.abs(q.top - r.top - 5) < 4; }); }, sel, 30000);
T.check('étape « PANEL ACTIVE » : le repère du chef encadre la touche 3D du RCP', (await stepId()) === 'active' && await spotOn('.p3d-hit.rcp-btn'));
await shot('05-chef-panel-active', 800);
await page.locator('.p3d-hit.rcp-btn', { hasText: 'PANEL ACTIVE' }).click();
await until(page, () => window.__dbg.TUTOR.done, null, 8000); await ev(() => window.__dbg.chefNext());
const sp = await spotOn('.p3d-hit.rjoy');
T.check('étape « Ouvrir l\'iris » : le repère encadre le joystick 3D', (await stepId()) === 'expo' && sp, JSON.stringify(await ev(() => { const s = document.getElementById('chef-spot'), j = document.querySelector('.p3d-hit.rjoy'); const r = s && s.getBoundingClientRect(), q = j && j.getBoundingClientRect(); return { step: window.__dbg.TUTOR.lesson?.steps[window.__dbg.TUTOR.i].id, done: window.__dbg.TUTOR.done, spot: s && !s.hidden && [r.left, r.top, r.width, r.height].map(Math.round), joy: q && [q.left, q.top, q.width, q.height].map(Math.round), view: window.__dbg.poste3d.P3D.view }; })));
await shot('06-chef-joystick', 500);
for (let k = 0; k < 8 && (await ev(() => !!window.__dbg.TUTOR.lesson)); k++) { await ev(() => window.__dbg.chefDoForMe()); await until(page, () => window.__dbg.TUTOR.done || !window.__dbg.TUTOR.lesson, null, 8000); await ev(() => window.__dbg.chefNext()); }
T.check('le parcours se termine en vue 3D', await until(page, () => !window.__dbg.TUTOR.lesson, null, 15000));

await page.click('#station .st-vue');
T.check('« Vue 2D » : le poste à plat revient', await until(page, () => !document.getElementById('station').classList.contains('p3d-on') && !!document.querySelector('#station .rcp'), null, 8000));
await page.click('#station .st-vue');
await until(page, () => window.__dbg.poste3d.P3D.active, null, 8000);
await ev(() => window.__dbg.closeStation());
T.check('en quittant le poste, la caméra de la marche retrouve son cadrage', await until(page, () => window.__dbg.S.mode === 'fps' && (!window.__dbg.pcam.view || !window.__dbg.pcam.view.enabled), null, 5000));

// ---------------- écran à forte densité (Retina, HiDPI) : les écrans recopiés ne grandissent pas ----------------
// la copie WebGL a la taille en pixels réels (× 2 ici) : dans le flux, elle agrandissait le moniteur à chaque image
const hd = await openPage(browser, { errors: T.errors, dpr: 2, query: 'full', viewport: { width: 1280, height: 760 }, before: (p) => p.addInitScript(() => { try { localStorage.setItem('carregie.poste3d', '3d'); } catch (e) { /* stockage indisponible */ } }) });
await hd.evaluate(() => window.__dbg.start('standard', 'jour', 'basse', false));
await until(hd, () => window.__dbg.S.mode === 'fps', null, 30000);
const hauteurs = () => hd.evaluate(() => { const m = document.querySelector('.p3d-mons'); return m ? [m.scrollHeight, ...[...m.querySelectorAll('[data-gl]')].map((x) => Math.round(x.getBoundingClientRect().height))] : []; });
for (const id of ['vision1', 'son']) {
  await hd.evaluate((id) => { const d = window.__dbg; d.closeStation?.(); d.goToStation(d.T.stations.find((x) => x.id === id), true); }, id);
  await until(hd, () => window.__dbg.poste3d.P3D.active && !!document.querySelector('.p3d-mons canvas.p3d-mirror'), null, 90000);
  await hd.waitForTimeout(1500);
  const h0 = await hauteurs(); await hd.waitForTimeout(6000); const h1 = await hauteurs();
  T.check(`densité 2, poste ${id} : les écrans du panneau gardent leur taille (le panneau ne descend pas sans fin)`, h0.length > 1 && JSON.stringify(h0) === JSON.stringify(h1), JSON.stringify([h0, h1]));
}
await hd.screenshot({ path: `${OUT}/07-densite-2.png` });
await hd.close();
await T.finish();
