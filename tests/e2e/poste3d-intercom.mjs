// Le poste intercom en 3D (src/poste3d/icom.js, src/poste3d/intercom.js) : le pupitre du réalisateur sur le bureau
// de production, TALK et LISTEN de chaque canal agissent par les mêmes gestes qu'en 2D (ICOMACT) ; à droite, le
// multiview, le programme, le journal de l'intercom et l'état du pupitre ; « Tous les réglages » contient le pupitre
// à plat (même état) ; le parcours « Parler à la bonne personne » vise les touches 3D.
// Les captures servent à relire l'écran : les regarder.
// node tests/e2e/poste3d-intercom.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('poste3d-intercom');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { errors: T.errors, query: 'full', viewport: { width: 1280, height: 760 }, before: (p) => p.addInitScript(() => { try { localStorage.setItem('carregie.poste3d', '3d'); } catch (e) { /* stockage indisponible */ } }) });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n, w = 2000) => { await page.waitForTimeout(w); await page.screenshot({ path: `${OUT}/${n}.png` }); };
const view = async (v) => { await page.click(`.p3d-views [data-view="${v}"]`); await until(page, () => !window.__dbg.poste3d.P3D.fly, null, 30000); };
const feed = () => ev(() => document.querySelector('.p3d-side .explain')?.textContent || '');

await ev(() => window.__dbg.start('standard', 'jour', 'basse', false));
await until(page, () => window.__dbg.S.mode === 'fps', null, 30000);

T.check('le pupitre d\'intercom est en 3D sur le bureau du réalisateur : boîtier en matière, 36 touches (TALK et LISTEN de 18 modules), micro col de cygne, afficheurs', await ev(() => {
  const n = new Map(); window.__dbg.T.scene.traverse((o) => { if (o.name && o.name.startsWith('pupitre-intercom')) n.set(o.name, o); });
  return !!n.get('pupitre-intercom-boitier')?.material.userData.tri && n.get('pupitre-intercom-touches-dessus')?.count === 36 && !!n.get('pupitre-intercom-micro') && !!n.get('pupitre-intercom-afficheurs');
}));

await ev(() => { const d = window.__dbg; d.goToStation(d.T.stations.find((x) => x.id === 'intercom'), true); });
T.check('poste intercom ouvert en vue 3D : couche transparente, bouton « Vue 2D »', await until(page, () => window.__dbg.poste3d.P3D.active && document.getElementById('station').classList.contains('p3d-on') && /Vue 2D/.test(document.querySelector('#station .st-vue')?.textContent || ''), null, 90000));
T.check('écran partagé : le multiview et le programme en direct, le journal de l\'intercom, l\'état du pupitre', await until(page, () => { const m = document.querySelector('.p3d-side .p3d-mons'); return !!m && ['mv', 'PGM'].every((k) => { const c = m.querySelector(`[data-gl="${k}"] canvas.p3d-mirror`); return c && c.width > 50; }) && !!m.querySelector('.p3d-icomlog') && /Tu écoutes/.test(m.querySelector('.p3d-icomstate')?.textContent || ''); }, null, 60000));
const nKeys = await ev(() => 2 + Math.min(6, window.__dbg.S.cams.length) + 9);
T.check('une zone TALK et une zone LISTEN par canal, nommées comme sur le pupitre à plat (aria-label « TALK CAMÉRAS »…), et une par afficheur', await ev((n) => document.querySelectorAll('.p3d-hits .icp-talk').length === n && document.querySelectorAll('.p3d-hits .icp-lis').length === n && document.querySelectorAll('.p3d-hits .icp-lcd3d').length === n && !!document.querySelector('.p3d-hits .icp-talk[aria-label="TALK CAMÉRAS"]'), nKeys), String(nKeys));
await shot('01-poste');

await view('touches');
await page.click('.p3d-hits .icp-talk[aria-label="TALK CAMÉRAS"]');
T.check('TALK CAMÉRAS : le micro s\'ouvre vers les cadreurs (touche allumée, journal, état du pupitre, fil)', await until(page, () => document.querySelector('.p3d-hits .icp-talk[aria-label="TALK CAMÉRAS"]').classList.contains('on') && /Canal ouvert vers : CAMÉRAS/.test(document.querySelector('.p3d-icomlog')?.textContent || '') && /Micro ouvert vers : CAMÉRAS/.test(document.querySelector('.p3d-icomstate')?.textContent || ''), null, 5000) && /TALK CAMÉRAS ouvert/.test(await feed()));
await page.click('.p3d-hits .icp-lis[aria-label="LISTEN ORDRES"]');
T.check('LISTEN ORDRES : l\'écoute de la conférence se coupe (touche éteinte, état du pupitre)', await until(page, () => !document.querySelector('.p3d-hits .icp-lis[aria-label="LISTEN ORDRES"]').classList.contains('on') && !/ORDRES/.test(document.querySelector('.p3d-icomstate p:last-child')?.textContent || ''), null, 5000));
await page.hover('.p3d-hits .icp-talk[aria-label="TALK COMMENT."]');
T.check('survol de TALK COMMENT. : la bulle dit le type de liaison (IFB) et la règle de l\'intercom', await until(page, () => { const t = document.querySelector('.p3d-tip'); return t && !t.hidden && /IFB/.test(t.textContent) && /referme le TALK/.test(t.textContent); }, null, 5000));
await page.locator('.p3d-hits .icp-lcd3d', { hasText: 'Afficheur CHAÎNE' }).click();
T.check('clic sur un afficheur : le fil explique le canal (CHAÎNE, liaison 4 fils)', await until(page, () => /CHAÎNE \(4 FILS\)/.test(document.querySelector('.p3d-side .explain')?.textContent || ''), null, 5000));
await shot('02-touches', 1200);

await page.click('.p3d-drawer-btn');
T.check('« Tous les réglages » : le pupitre à plat suit le même état (TALK CAMÉRAS allumé), avec le trajet d\'un ordre', await until(page, () => { const d = document.querySelector('.p3d-drawer'); return d && !d.hidden && !!d.querySelector('.icp .icp-talk[aria-label="TALK CAMÉRAS"].on') && /trajet d'un ordre/.test(d.textContent); }, null, 8000));
await page.click('.p3d-drawer .icp-talk[aria-label="TALK CAMÉRAS"]');
T.check('fermé depuis le tiroir : la touche 3D s\'éteint aussi', await until(page, () => !document.querySelector('.p3d-hits .icp-talk[aria-label="TALK CAMÉRAS"]').classList.contains('on'), null, 5000));
await shot('03-tiroir', 1200);
await page.click('.p3d-drawer-btn');

// ---------------- le chef de car : « Parler à la bonne personne » ----------------
await view('poste');
await ev(() => { window.__dbg.toggleChef(true); window.__dbg.startChefLesson('intercom-parler'); });
await until(page, () => window.__dbg.TUTOR.lesson?.id === 'intercom-parler', null, 8000);
const stepId = () => ev(() => { const U = window.__dbg.TUTOR; return U.lesson ? U.lesson.steps[U.i].id : null; });
for (let k = 0; k < 4 && (await stepId()) !== 'cams'; k++) { await ev(() => window.__dbg.chefDoForMe()); await page.waitForTimeout(1500); await ev(() => window.__dbg.chefNext()); }
const spotOn = (sel) => until(page, (sel) => { const s = document.getElementById('chef-spot'); if (!s || s.hidden) return false; const r = s.getBoundingClientRect(); return [...document.querySelectorAll(sel)].some((x) => { const q = x.getBoundingClientRect(); return q.width > 0 && Math.abs(q.left - r.left - 5) < 4 && Math.abs(q.top - r.top - 5) < 4; }); }, sel, 30000);
T.check('étape « Parler aux cadreurs » : le repère du chef encadre la touche 3D TALK CAMÉRAS', (await stepId()) === 'cams' && await spotOn('.p3d-hits .icp-talk[aria-label="TALK CAMÉRAS"]'));
await shot('04-chef-cameras', 800);
await page.click('.p3d-hits .icp-talk[aria-label="TALK CAMÉRAS"]');
await until(page, () => window.__dbg.TUTOR.done, null, 8000); await ev(() => window.__dbg.chefNext());
T.check('étape « Un point direct » : le repère encadre TALK EVS ; « Fais-le pour moi » ouvre le micro', (await stepId()) === 'evs' && await spotOn('.p3d-hits .icp-talk[aria-label="TALK EVS"]') && (await ev(() => window.__dbg.chefDoForMe()), await until(page, () => window.__dbg.TUTOR.done && document.querySelector('.p3d-hits .icp-talk[aria-label="TALK EVS"]').classList.contains('on'), null, 8000)));
await ev(() => window.__dbg.stopChefLesson && window.__dbg.stopChefLesson());

await page.click('#station .st-vue');
T.check('« Vue 2D » : le pupitre à plat revient', await until(page, () => !document.getElementById('station').classList.contains('p3d-on') && !!document.querySelector('#station .icp .icp-key'), null, 8000));
await page.click('#station .st-vue');
await until(page, () => window.__dbg.poste3d.P3D.active, null, 8000);
await ev(() => window.__dbg.closeStation());
T.check('en quittant le poste, la caméra de la marche retrouve son cadrage', await until(page, () => window.__dbg.S.mode === 'fps' && (!window.__dbg.pcam.view || !window.__dbg.pcam.view.enabled), null, 5000));
await T.finish();
