// Le poste ralentis en 3D (src/poste3d/lsm.js, src/poste3d/ralentis.js) : la télécommande LSM sur le bureau des
// ralentis, ses touches (F, angles, bloc opérationnel), le levier de vitesse et la molette jog agissent sur le
// serveur par les mêmes gestes qu'en 2D (LSMACT) ; à droite, EVS A, EVS B, le programme et l'écran du serveur ;
// « Tous les réglages » contient la télécommande à plat ; Olivier vise les touches 3D.
// Les captures servent à relire l'écran : les regarder.
// node tests/e2e/poste3d-evs.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('poste3d-evs');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { errors: T.errors, query: 'full', viewport: { width: 1280, height: 760 }, before: (p) => p.addInitScript(() => { try { localStorage.setItem('carregie.poste3d', '3d'); } catch (e) { /* stockage indisponible */ } }) });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n, w = 2000) => { await page.waitForTimeout(w); await page.screenshot({ path: `${OUT}/${n}.png` }); };
const view = async (v) => { await page.click(`.p3d-views [data-view="${v}"]`); await until(page, () => !window.__dbg.poste3d.P3D.fly, null, 30000); };
const ch = () => ev(() => { const c = window.__dbg.EVS.ch[0]; return { mode: c.mode, t: c.t, in: c.in, out: c.out, cam: c.cam, lever: c.lever, playing: c.playing }; });
const key = (text) => page.locator('.p3d-hits .lsm-key', { hasText: new RegExp('^' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') });

await ev(() => window.__dbg.start('standard', 'jour', 'basse', false));
await until(page, () => window.__dbg.S.mode === 'fps', null, 30000);

T.check('la télécommande LSM est en 3D sur le bureau des ralentis : boîtier en matière, 35 touches instanciées, levier et molette', await ev(() => {
  const n = new Map(); window.__dbg.T.scene.traverse((o) => { if (o.name && o.name.startsWith('telecommande-lsm')) n.set(o.name, o); });
  return !!n.get('telecommande-lsm-boitier')?.material.userData.tri && n.get('telecommande-lsm-touches-dessus')?.count === 35 && !!n.get('telecommande-lsm-levier') && !!n.get('telecommande-lsm-jog');
}));

// laisser les trains d'enregistrement se remplir avant de chercher une action
await until(page, () => window.__dbg.S.simTime > 14, null, 120000);
await ev(() => { const d = window.__dbg; d.goToStation(d.T.stations.find((x) => x.id === 'evsA'), true); });
T.check('poste ralentis ouvert en vue 3D : couche transparente, bouton « Vue 2D »', await until(page, () => window.__dbg.poste3d.P3D.active && document.getElementById('station').classList.contains('p3d-on') && /Vue 2D/.test(document.querySelector('#station .st-vue')?.textContent || ''), null, 90000));
T.check('écran partagé : EVS A, EVS B et le programme en direct (recopiés du rendu WebGL), puis l\'écran du serveur (trains, clips, playlist)', await until(page, () => { const m = document.querySelector('.p3d-side .p3d-mons'); return !!m && ['EVSA', 'EVSB', 'PGM'].every((k) => { const c = m.querySelector(`[data-gl="${k}"] canvas.p3d-mirror`); return c && c.width > 50; }) && !!m.querySelector('.lsm-screen .lsm-trains') && m.querySelectorAll('.lsm-clip').length === 10; }, null, 60000));
T.check('une zone par touche (10 F, 8 angles, 14 du bloc opérationnel, 3 raccourcis), le levier et la molette ; les angles enregistrés portent leur caméra (data-id)', await ev(() => {
  const k = document.querySelectorAll('.p3d-hits .lsm-key'), rec = window.__dbg.EVS ? document.querySelectorAll('.p3d-hits .lsm-key[data-id]').length : 0;
  return k.length === 35 && rec >= 2 && !!document.querySelector('.p3d-hit.lsm-lever-3d') && !!document.querySelector('.p3d-hit.p3d-jog');
}));
await shot('01-poste');

await view('touches');
await key('REC').click();
T.check('REC : l\'enregistrement s\'arrête (le fil prévient), un second appui le relance', await until(page, () => !window.__dbg.EVS.recording && /ARRÊTÉ/.test(document.querySelector('.p3d-side .explain')?.textContent || ''), null, 5000) && (await key('REC').click(), await until(page, () => window.__dbg.EVS.recording, null, 5000)));
await ev(() => { const S = window.__dbg.S; S.lastAction = { t: S.simTime - 5, type: 'shot', label: 'Tir' }; });
await key('DERN. ACTION').click();
T.check('DERN. ACTION : la sortie se cale en pause avant l\'action, IN posé', await until(page, () => { const c = window.__dbg.EVS.ch[0]; return c.mode === 'pause' && c.in != null; }, null, 5000), JSON.stringify(await ch()));
const camB = await ev(() => document.querySelectorAll('.p3d-hits .lsm-key[data-id]')[1]?.dataset.id);
await page.click(`.p3d-hits .lsm-key[data-id="${camB}"]`);
T.check('touche d\'angle : la CAM de l\'angle B est relue, au même timecode', await until(page, (id) => window.__dbg.EVS.ch[0].cam === +id, camB, 5000) && await until(page, () => /même timecode/.test(document.querySelector('.p3d-side .explain')?.textContent || ''), null, 5000));
await key('F1').click();
T.check('F1 avec un IN marqué : le clip est créé sur la touche (écran du serveur et touche allumée)', await until(page, () => !!window.__dbg.EVS.clips[0] && document.querySelector('.p3d-mons .lsm-clip')?.classList.contains('full'), null, 5000));
await shot('02-touches', 1200);

// molette jog : molette de la souris (+2 images), puis glisser en rond autour d'elle
await view('levier');
const t0 = (await ch()).t;
const jb = await page.locator('.p3d-hit.p3d-jog').boundingBox();
await page.mouse.move(jb.x + jb.width / 2, jb.y + jb.height / 2); await page.mouse.wheel(0, 120);
T.check('molette de la souris sur la jog : deux images plus loin (0,04 s), le fil donne la position', await until(page, (t0) => Math.abs(window.__dbg.EVS.ch[0].t - t0 - 0.04) < 0.005, t0, 5000) && await until(page, () => /Jog \+2/.test(document.querySelector('.p3d-side .explain')?.textContent || ''), null, 5000), JSON.stringify([t0, (await ch()).t]));
const t1 = (await ch()).t, cx = jb.x + jb.width / 2, cy = jb.y + jb.height / 2, R = Math.min(jb.width, jb.height) * 0.4;
await page.mouse.move(cx + R, cy); await page.mouse.down();
for (let k = 1; k <= 8; k++) { const a = k / 8 * Math.PI / 2; await page.mouse.move(cx + R * Math.cos(a), cy + R * Math.sin(a)); }
await page.mouse.up();
T.check('jog tournée d\'un quart de tour dans le sens des aiguilles d\'une montre : environ 9 images vers l\'avant, la molette 3D tourne', await until(page, (t1) => { const d = window.__dbg.EVS.ch[0].t - t1; return d > 0.1 && d < 0.3; }, t1, 5000) && await ev(() => Math.abs(window.__dbg.poste3d.LSMS.jogA) > 1), JSON.stringify([t1, (await ch()).t]));
// levier : pousser loin de soi
const lb = await page.locator('.p3d-hit.lsm-lever-3d').boundingBox();
await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height * 0.9); await page.mouse.down(); await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height * 0.35, { steps: 6 }); await page.mouse.up();
T.check('levier poussé : la vitesse monte et la lecture démarre (ralenti), le fil explique la cadence', await until(page, () => { const c = window.__dbg.EVS.ch[0]; return c.lever > 0.3 && c.playing; }, null, 5000) && await until(page, () => /Levier \d+ %/.test(document.querySelector('.p3d-side .explain')?.textContent || ''), null, 5000), JSON.stringify(await ch()));
await page.hover('.p3d-hit.lsm-lever-3d');
T.check('survol du levier : la bulle donne la vitesse et dit si le ralenti est fluide', await until(page, () => { const t = document.querySelector('.p3d-tip'); return t && !t.hidden && /Levier à \d+ %/.test(t.textContent) && /(fluide|saccade)/.test(t.textContent); }, null, 5000));
await shot('03-levier-jog', 1200);
await view('touches');
await key('LIVE E/E').click();
T.check('LIVE E/E : la sortie revient au direct, la touche s\'allume', await until(page, () => window.__dbg.EVS.ch[0].mode === 'live' && [...document.querySelectorAll('.p3d-hits .lsm-key')].some((x) => x.textContent === 'LIVE E/E' && x.classList.contains('on')), null, 5000));

// écran du serveur : un clic dans les trains place la sortie à cet instant
const tb = await page.locator('.p3d-mons .lsm-trains').boundingBox();
await page.mouse.click(tb.x + tb.width * 0.7, tb.y + tb.height * 0.5);
T.check('clic dans les trains d\'enregistrement (panneau de droite) : la sortie se place à cet instant, en pause', await until(page, () => { const c = window.__dbg.EVS.ch[0]; return c.mode === 'pause' && window.__dbg.S.simTime - c.t > 5; }, null, 5000), JSON.stringify(await ch()));

await page.click('.p3d-drawer-btn');
T.check('« Tous les réglages » : la télécommande à plat (touches, levier et préréglages, jog), sans second écran du serveur', await until(page, () => { const d = document.querySelector('.p3d-drawer'); return d && !d.hidden && !!d.querySelector('.lsm.noscreen .lsm-pad') && !!d.querySelector('input.lsm-lever') && !d.querySelector('.lsm-screen'); }, null, 8000));
await shot('04-tiroir', 1500);
await page.click('.p3d-drawer-btn');

// ---------------- le chef de car : « Faire un ralenti » vise les touches 3D ----------------
await view('poste');
await ev(() => { window.__dbg.toggleChef(true); window.__dbg.startChefLesson('evs-ralenti'); });
await until(page, () => window.__dbg.TUTOR.lesson?.id === 'evs-ralenti', null, 8000);
const stepId = () => ev(() => { const U = window.__dbg.TUTOR; return U.lesson ? U.lesson.steps[U.i].id : null; });
for (let k = 0; k < 5 && (await stepId()) !== 'cue'; k++) { await ev(() => window.__dbg.chefDoForMe()); await page.waitForTimeout(1500); await ev(() => window.__dbg.chefNext()); }
const spotOn = (sel, text) => until(page, ([sel, text]) => { const s = document.getElementById('chef-spot'); if (!s || s.hidden) return false; const r = s.getBoundingClientRect(); return [...document.querySelectorAll(sel)].some((x) => { const q = x.getBoundingClientRect(); return q.width > 0 && (!text || x.textContent.includes(text)) && Math.abs(q.left - r.left - 5) < 4 && Math.abs(q.top - r.top - 5) < 4; }); }, [sel, text], 30000);
T.check('étape « Repérer l\'action » : le repère du chef encadre la touche 3D DERN. ACTION', (await stepId()) === 'cue' && await spotOn('.p3d-hits .lsm-key', 'DERN. ACTION'));
await shot('05-chef-dern-action', 800);
await key('DERN. ACTION').click();
await until(page, () => window.__dbg.TUTOR.done, null, 8000); await ev(() => window.__dbg.chefNext());
T.check('étape « Choisir l\'angle » : le repère encadre la touche d\'angle 3D de la caméra conseillée', (await stepId()) === 'angle' && await spotOn('.p3d-hits .lsm-key[data-id]'));
await ev(() => window.__dbg.stopChefLesson && window.__dbg.stopChefLesson());

await page.click('#station .st-vue');
T.check('« Vue 2D » : la télécommande à plat revient, avec l\'écran du serveur', await until(page, () => !document.getElementById('station').classList.contains('p3d-on') && !!document.querySelector('#station .lsm .lsm-screen'), null, 8000));
await page.click('#station .st-vue');
await until(page, () => window.__dbg.poste3d.P3D.active, null, 8000);
await ev(() => window.__dbg.closeStation());
T.check('en quittant le poste, la caméra de la marche retrouve son cadrage', await until(page, () => window.__dbg.S.mode === 'fps' && (!window.__dbg.pcam.view || !window.__dbg.pcam.view.enabled), null, 5000));
await T.finish();
