// Le poste son en 3D (src/poste3d/son.js) devant la console de la cabine (audiodesk.js) : faders des tranches et des
// masters, SEL / PFL / MUTE, molettes GAIN et PAN de l'écran Vistonics, Control Bay (écoute, DIM, talkback maintenu) ;
// les gestes sont ceux de la 2D (AUACT) ; « Tous les réglages » contient la console à plat ; le parcours « Corriger une
// tranche » renvoie au tiroir pour la tranche 2D.
// Les captures servent à relire l'écran : les regarder.
// node tests/e2e/poste3d-son.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('poste3d-son');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { errors: T.errors, query: 'full', viewport: { width: 1280, height: 760 }, before: (p) => p.addInitScript(() => { try { localStorage.setItem('carregie.poste3d', '3d'); } catch (e) { /* stockage indisponible */ } }) });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n, w = 2000) => { await page.waitForTimeout(w); await page.screenshot({ path: `${OUT}/${n}.png` }); };
const view = async (v) => { await page.click(`.p3d-views [data-view="${v}"]`); await until(page, () => !window.__dbg.poste3d.P3D.fly, null, 20000); };
const ch = (k) => ev((k) => { const c = window.__dbg.AU.ch[k]; return { fader: c.fader, mute: c.mute, pfl: c.pfl, gain: c.gain, pan: c.pan }; }, k);

await ev(() => window.__dbg.start('standard', 'jour', 'basse', false));
await until(page, () => window.__dbg.S.mode === 'fps', null, 30000);
await ev(() => { const d = window.__dbg; d.goToStation(d.T.stations.find((x) => x.id === 'son'), true); });
T.check('poste son ouvert en vue 3D devant la console', await until(page, () => window.__dbg.poste3d.P3D.active && document.getElementById('station').classList.contains('p3d-on'), null, 90000));
const n = await ev(() => window.__dbg.AU.order.length);
T.check('pour chaque tranche : un fader, SEL, PFL, MUTE et deux molettes ; deux masters ; les touches de la Control Bay', await ev((n) => document.querySelectorAll('.p3d-hit.p3d-fader').length === Math.min(n, 20) && document.querySelectorAll('.p3d-hit.vx-mute').length === Math.min(n, 20) && document.querySelectorAll('.p3d-hit.p3d-knob').length === 2 * Math.min(n, 20) && !!document.querySelector('.p3d-hit[aria-label="Fader Master PGM"]') && document.querySelectorAll('.p3d-hit.hw').length === 12, n));
await shot('01-poste');

await view('faders');
// une tranche du milieu (les premières sont au bord de l'image dans cette vue) qui n'est pas un canon : les faders
// des canons sont motorisés par l'assistant de suivi du jeu
const I = await ev(() => window.__dbg.AU.order.findIndex((k, i) => i >= 6 && window.__dbg.AU.ch[k].group !== 'canon'));
const k0 = await ev((i) => window.__dbg.AU.order[i], I);
const f0 = (await ch(k0)).fader;
const fb = await page.locator('.p3d-hit.p3d-fader').nth(I).boundingBox();
await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2); await page.mouse.down(); await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height, { steps: 5 }); await page.mouse.up();
T.check('fader d\'une tranche du milieu tiré vers soi : il descend, le fil l\'explique', await until(page, (k) => window.__dbg.AU.ch[k].fader < -10 && /Le fader dose/.test(document.querySelector('.p3d-side .explain')?.textContent || ''), k0, 5000), JSON.stringify([f0, (await ch(k0)).fader]));
T.check('le fader motorisé de la console 3D suit (son bouton à la position de son niveau)', await until(page, (a) => { const k = a[0]; const z = window.__dbg.poste3d.DESK.caps.instanceMatrix.array[a[1] * 16 + 14]; const p = Math.min(1, Math.max(0, (window.__dbg.AU.ch[k].fader + 60) / 70)); return Math.abs(z - (-0.085 - 0.12 * p)) < 0.006; }, [k0, I], 5000));
await page.locator('.p3d-hit.vx-mute').nth(I).click();
T.check('MUTE : la tranche est coupée', (await ch(k0)).mute);
await page.locator('.p3d-hit.vx-mute').nth(I).click();
await page.locator('.p3d-hit.vb', { hasText: 'PFL' }).nth(I).click();
T.check('PFL : la tranche passe en pré-écoute', (await ch(k0)).pfl);
await page.locator('.p3d-hit.vb', { hasText: 'PFL' }).nth(I).click();
await shot('02-faders', 1200);

await view('ecrans');
const g0 = (await ch(k0)).gain;
await page.locator('.p3d-hit.p3d-knob').nth(2 * I).hover(); await page.mouse.wheel(0, 300);
T.check('molette GAIN (molette de la souris vers soi) : le gain d\'entrée baisse', await until(page, (a) => window.__dbg.AU.ch[a[0]].gain < a[1], [k0, g0], 5000));
T.check('survol : la bulle nomme la molette', await until(page, () => /GAIN/.test(document.querySelector('.p3d-tip')?.textContent || ''), null, 5000));
await shot('03-ecrans', 1200);

await view('cbay');
await page.locator('.p3d-hit.hw', { hasText: 'DIM' }).click();
T.check('Control Bay : DIM', await ev(() => window.__dbg.AU.dim === true));
await page.locator('.p3d-hit.hw', { hasText: 'DIM' }).click();
const tb = page.locator('.p3d-hit.hw', { hasText: 'TB COMM' }); const tbb = await tb.boundingBox();
await page.mouse.move(tbb.x + tbb.width / 2, tbb.y + tbb.height / 2); await page.mouse.down();
T.check('talkback maintenu : le micro d\'ordres part dans le N-1 des commentateurs', await until(page, () => window.__dbg.AU.tb === 'n1', null, 5000));
await page.mouse.up();
T.check('talkback relâché', await until(page, () => !window.__dbg.AU.tb, null, 5000));
await shot('04-control-bay', 1200);

// ---------------- le chef : « Corriger une tranche » renvoie au tiroir ----------------
await view('poste');
await ev(() => { window.__dbg.toggleChef(true); window.__dbg.startChefLesson('son-tranche'); });
await until(page, () => window.__dbg.TUTOR.lesson?.id === 'son-tranche', null, 8000);
const stepId = () => ev(() => { const U = window.__dbg.TUTOR; return U.lesson ? U.lesson.steps[U.i].id : null; });
for (let k = 0; k < 4 && (await stepId()) !== 'gain'; k++) { await ev(() => window.__dbg.chefDoForMe()); await page.waitForTimeout(1500); await ev(() => window.__dbg.chefNext()); }
const spotOn = (sel) => until(page, (sel) => { const s = document.getElementById('chef-spot'); if (!s || s.hidden) return false; const r = s.getBoundingClientRect(); const x = document.querySelector(sel); if (!x) return false; const q = x.getBoundingClientRect(); return Math.abs(q.left - r.left - 5) < 4 && Math.abs(q.top - r.top - 5) < 4; }, sel, 30000);
T.check('étape « Un canon sature » : le repère montre « Tous les réglages » (la tranche 2D est dans le tiroir)', (await stepId()) === 'gain' && await spotOn('.p3d-drawer-btn'));
await page.click('.p3d-drawer-btn');
T.check('tiroir ouvert : le repère passe dans la console à plat (la vue ENTRÉE, puis la tranche CANON 3, comme en 2D)', await until(page, () => { const s = document.getElementById('chef-spot'); const d = document.querySelector('.p3d-drawer'); if (!s || s.hidden || !d || d.hidden) return false; const r = s.getBoundingClientRect(), q = d.getBoundingClientRect(); return r.left + 5 >= q.left - 2 && r.right - 5 <= q.right + 2 && r.top + 5 >= q.top - 2 && /ENTRÉE|CANON 3/.test(s.textContent || ''); }, null, 30000));
T.check('le moniteur du programme du tiroir est recopié du rendu WebGL', await until(page, () => [...document.querySelectorAll('.p3d-drawer canvas.p3d-mirror')].some((c) => c.width > 50), null, 10000));
await shot('05-tiroir-chef', 1500);
for (let k = 0; k < 8 && (await ev(() => !!window.__dbg.TUTOR.lesson)); k++) { await ev(() => window.__dbg.chefDoForMe()); await until(page, () => window.__dbg.TUTOR.done || !window.__dbg.TUTOR.lesson, null, 8000); await ev(() => window.__dbg.chefNext()); }
T.check('le parcours se termine en vue 3D', await until(page, () => !window.__dbg.TUTOR.lesson, null, 15000));
await ev(() => window.__dbg.closeStation());
T.check('en quittant le poste, la caméra de la marche retrouve son cadrage', await until(page, () => window.__dbg.S.mode === 'fps' && (!window.__dbg.pcam.view || !window.__dbg.pcam.view.enabled), null, 5000));
await T.finish();
