// Les postes en 3D (src/poste3d/) : le poste Mélangeur s'ouvre devant le vrai pupitre (ICP-X7000 modélisé
// touche par touche), avec une zone cliquable sur chaque commande, une bulle au survol, des étiquettes, des
// vues, la fiche de la zone et le fil « Ce qui se passe ». Les gestes agissent sur le mélangeur ; le parcours
// du chef de car vise les mêmes sélecteurs qu'en 2D ; la vue 2D reste au choix.
// Les captures servent à relire l'écran : les regarder.
// node tests/e2e/poste3d.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('poste3d');
const T = reporter();
const browser = await launch();
// qualité Basse (le rendu logiciel des tests est lent) avec la vue 3D choisie : en Basse, le défaut est la 2D
const page = await openPage(browser, { errors: T.errors, query: 'full', viewport: { width: 1280, height: 760 }, before: (p) => p.addInitScript(() => { try { localStorage.setItem('carregie.poste3d', '3d'); } catch (e) { /* stockage indisponible */ } }) });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n, w = 2500) => { await page.waitForTimeout(w); await page.screenshot({ path: `${OUT}/${n}.png` }); };
const view = async (v) => { await page.click(`.p3d-views [data-view="${v}"]`); await until(page, () => !window.__dbg.poste3d.P3D.fly, null, 20000); };

await ev(() => window.__dbg.start('standard', 'jour', 'basse', false));
await until(page, () => window.__dbg.S.mode === 'fps', null, 30000);
T.check('vue par défaut : 3D en qualité Moyenne ou Haute, 2D en qualité Basse et en mode allégé ; sinon le choix mémorisé', await ev(() => {
  const P = window.__dbg.poste3d, S = window.__dbg.S, q = S.quality, lite = S.lite;
  localStorage.removeItem('carregie.poste3d');
  const r = [(S.quality = 'moyenne', P.voulu()), (S.quality = 'basse', P.voulu()), (S.quality = 'haute', S.lite = true, P.voulu())];
  S.quality = q; S.lite = lite; localStorage.setItem('carregie.poste3d', '3d');
  return r.join() === 'true,false,false' && P.voulu() === true;
}));

// ---------------- le pupitre dans le car ----------------
T.check('le pupitre du truquiste est en 3D dans le car : châssis en matière plastique, habillage alu, touches instanciées (plus de 100), barre T', await ev(() => {
  const n = new Map(); window.__dbg.T.scene.traverse((o) => { if (o.name && o.name.startsWith('pupitre-icp')) n.set(o.name, o); });
  const ch = n.get('pupitre-icp-chassis'), keys = n.get('pupitre-icp-touches-dessus');
  return !!ch && !!ch.material.userData.tri && n.has('pupitre-icp-alu') && !!keys && keys.isInstancedMesh && keys.count > 100 && n.has('pupitre-icp-barre-t');
}));

// ---------------- le poste en vue 3D ----------------
await ev(() => { const d = window.__dbg; d.goToStation(d.T.stations.find((x) => x.id === 'melangeur'), true); });
T.check('poste Mélangeur ouvert en vue 3D : couche transparente, en-tête, bouton « Vue 2D »', await until(page, () => document.getElementById('station').classList.contains('p3d-on') && window.__dbg.poste3d.P3D.active && /Vue 2D/.test(document.querySelector('#station .st-vue')?.textContent || ''), null, 90000));
T.check('une zone cliquable par commande, chacune nommée (texte lisible par un lecteur d\'écran) ; 22 touches par rangée de croisement', await ev(() => { const h = [...document.querySelectorAll('#station .p3d-hit')]; return h.length > 100 && h.every((x) => (x.textContent || '').trim().length > 1) && document.querySelectorAll('#station .p3d-hit.xpt.pst').length === 22; }));
T.check('les zones suivent les touches à l\'écran : la zone de B · PST 3 a la taille d\'une touche vue d\'en face (entre 9 et 80 px), dans la moitié 3D', await until(page, () => { const b = document.querySelector('#station .xpt.pst[aria-label="B · PST entrée 3"]'); if (!b) return false; const r = b.getBoundingClientRect(), s = document.querySelector('.p3d-side').getBoundingClientRect(); return r.width > 9 && r.width < 80 && r.height > 6 && r.top > 200 && r.right < s.left; }, null, 8000), await ev(() => { const r = document.querySelector('#station .xpt.pst[aria-label="B · PST entrée 3"]')?.getBoundingClientRect(); return r ? JSON.stringify([r.left, r.top, r.width, r.height].map(Math.round)) : ''; }));
T.check('étiquettes des zones du pupitre et fiche d\'accueil à droite, fil « Ce qui se passe »', await ev(() => document.querySelectorAll('#station .p3d-tag:not([hidden])').length >= 4 && /Le pupitre du truquiste/.test(document.querySelector('.p3d-fiche')?.textContent || '') && !!document.querySelector('.p3d-side .explain')));
T.check('écran partagé : à droite, le multiview, le PGM et le PVW en direct (recopiés du rendu WebGL)', await until(page, () => ['mv', 'PGM', 'PVW'].every((k) => { const c = document.querySelector(`.p3d-side .p3d-mons [data-gl="${k}"] canvas.p3d-mirror`); return c && c.width > 50; }), null, 60000));
// orbite autour du pupitre : glisser tourne, la molette rapproche, double-clic revient à la vue
const camPos = () => ev(() => { const p = window.__dbg.pcam.position; return [p.x, p.y, p.z]; });
const orb = () => ev(() => ({ ...window.__dbg.poste3d.P3D.orb, t: null }));
const p0 = await camPos(), o0 = await orb();
await page.mouse.move(300, 200); await page.mouse.down(); await page.mouse.move(420, 170, { steps: 6 }); await page.mouse.up();
T.check('glisser sur la scène : la caméra tourne autour du pupitre (orbite)', await until(page, (p0) => { const p = window.__dbg.pcam.position; return Math.hypot(p.x - p0[0], p.y - p0[1], p.z - p0[2]) > 0.05; }, p0, 10000) && Math.abs((await orb()).theta - o0.theta) > 0.1);
await page.mouse.move(300, 200); await page.mouse.wheel(0, -400);
T.check('molette : la caméra s\'approche de la cible', await until(page, (r0) => window.__dbg.poste3d.P3D.orb.r < r0 * 0.8, o0.r, 8000));
await page.mouse.dblclick(300, 200);
T.check('double-clic : retour à la vue du poste', await until(page, (r0) => !window.__dbg.poste3d.P3D.fly && Math.abs(window.__dbg.poste3d.P3D.orb.r - r0) < 0.01, o0.r, 10000), JSON.stringify(await ev((r0) => { const e = document.elementFromPoint(300, 200); return { r0, r: window.__dbg.poste3d.P3D.orb.r, fly: !!window.__dbg.poste3d.P3D.fly, sous: e && (e.className || e.tagName) }; }, o0.r)));
await page.click('.p3d-fold');
T.check('« replier » : la fiche se range, les écrans prennent toute la hauteur', await until(page, () => document.querySelector('.p3d-side').classList.contains('p3d-folded') && getComputedStyle(document.querySelector('.p3d-tabbody')).display === 'none', null, 5000));
await shot('01b-ecrans-pleine-hauteur', 1500);
await page.click('.p3d-tab >> nth=1');
T.check('un onglet rouvre le bas du panneau : le fil « Ce qui se passe »', await until(page, () => !document.querySelector('.p3d-side').classList.contains('p3d-folded') && !document.querySelector('.p3d-tabbody > .explain').hidden, null, 5000));
await shot('01-poste');

await view('xpt');
await page.hover('#station .xpt.pst[aria-label="B · PST entrée 3"]');
T.check('survol : la bulle donne le nom de la touche et son rôle', await until(page, () => { const t = document.querySelector('.p3d-tip'); return t && !t.hidden && /B · PST · entrée 3/.test(t.textContent) && /preset/.test(t.textContent); }, null, 5000));
await shot('02-croisements-survol', 1500);
await page.click('#station .xpt.pst[aria-label="B · PST entrée 3"]');
T.check('clic sur B · PST 3 : l\'entrée 3 passe en preset, le fil l\'explique', await until(page, () => window.__dbg.MIX.pst === 3 && /PST \(preset\)/.test(document.querySelector('.p3d-side .explain')?.textContent || ''), null, 5000));
T.check('la touche s\'allume sur le pupitre 3D (dessus vert, plus lumineux que sa voisine)', await until(page, () => { const P = window.__dbg.poste3d.PUP; const c = P.keys.tops.instanceColor; const i = P.ctrls.findIndex((x) => x.t === 'xpt' && x.bus === 'pst' && x.n === 3), j = P.ctrls.findIndex((x) => x.t === 'xpt' && x.bus === 'pst' && x.n === 4); return c.getY(i) > c.getY(j) * 1.5; }, null, 5000));

await view('trans');
await page.locator('#station .hw.big', { hasText: 'CUT' }).click();
T.check('CUT : l\'entrée 3 passe à l\'antenne', await until(page, () => window.__dbg.MIX.pgm === 3, null, 5000));
const bb = await page.locator('#tbar').boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + 3); await page.mouse.down();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height * 0.5, { steps: 5 });
T.check('barre T glissée à mi-course : transition à mi-chemin, afficheur et poignée suivent', await until(page, () => { const M = window.__dbg.MIX; return M.pos > 0.2 && M.pos < 0.8 && Math.abs(window.__dbg.poste3d.PUP.lever.position.z - (-0.06 + 0.21 * M.tbar)) < 0.01; }, null, 20000), await ev(() => JSON.stringify([window.__dbg.MIX.pos, window.__dbg.MIX.tbar, window.__dbg.poste3d.PUP.lever.position.z])));
await shot('03-transition-barre-t', 1500);
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height + 40, { steps: 5 }); await page.mouse.up();
T.check('barre T en butée : la transition est faite (PGM et PST échangés), le sens s\'inverse', await until(page, () => window.__dbg.MIX.pgm === 1 && window.__dbg.MIX.pst === 3 && window.__dbg.MIX.tbarDir === -1, null, 5000));

await view('menu');
await page.click('#station .p3d-hit.p3d-menu');
T.check('l\'écran du menu ouvre ses réglages en 2D sur la fiche (durée, taille de la clé, clavier)', await until(page, () => !!document.querySelector('.p3d-fiche #mixrate') && /Menu et mémoires/.test(document.querySelector('.p3d-fiche').textContent), null, 5000));
await page.fill('.p3d-fiche #mixrate', '30'); await page.press('.p3d-fiche #mixrate', 'Enter'); await page.locator('.p3d-fiche h3').click();
T.check('durée réglée à 30 images depuis la fiche', await until(page, () => window.__dbg.MIX.rate === 30, null, 5000));
await shot('04-menu', 1500);
await view('cles'); await shot('05-cle-dsk', 1500);
await view('ecrans'); await shot('06-ecrans', 1500);

// ---------------- le chef de car vise les touches 3D ----------------
await view('poste');
// preset sur l'EVS A : la caméra que demandera le parcours n'est pas déjà préparée (l'étape serait faite d'office)
await ev(() => { window.__dbg.MIX.pst = 17; window.__dbg.toggleChef(true); window.__dbg.startChefLesson('melangeur-commuter'); });
await until(page, () => window.__dbg.TUTOR.lesson && window.__dbg.TUTOR.lesson.id === 'melangeur-commuter', null, 8000);
// jusqu'à l'étape « Préparer une caméra » (intro, puis aller au poste)
const stepId = () => ev(() => { const U = window.__dbg.TUTOR; return U.lesson ? U.lesson.steps[U.i].id : null; });
for (let k = 0; k < 4 && (await stepId()) !== 'pst'; k++) await ev(() => window.__dbg.chefNext());
const seen = await until(page, () => {
  const s = document.getElementById('chef-spot'); if (!s || s.hidden) return false;
  const r = s.getBoundingClientRect();
  return [...document.querySelectorAll('#station .xpt.pst.p3d-hit')].some((x) => { const q = x.getBoundingClientRect(); return q.width > 0 && Math.abs(q.left - r.left - 5) < 4 && Math.abs(q.top - r.top - 5) < 4; });
}, null, 30000);
T.check('parcours « Préparer, couper et enchaîner », étape « Préparer une caméra » : le repère du chef de car encadre la touche 3D de la rangée B · PST', (await stepId()) === 'pst' && seen);
await shot('07-chef-repere', 1000);
// la suite du parcours par « Fais-le pour moi » : chaque geste passe par le mélangeur, le poste reste en 3D
for (let k = 0; k < 12 && (await ev(() => !!window.__dbg.TUTOR.lesson)); k++) {
  await ev(() => window.__dbg.chefDoForMe());
  await until(page, () => window.__dbg.TUTOR.done || !window.__dbg.TUTOR.lesson, null, 6000);
  await ev(() => window.__dbg.chefNext());
}
T.check('le parcours se déroule jusqu\'au bout en vue 3D', await until(page, () => !window.__dbg.TUTOR.lesson, null, 15000));

// ---------------- vue 2D au choix, retour à la marche ----------------
await page.click('#station .st-vue');
T.check('« Vue 2D » : l\'interface plate revient (rangées de boutons, multiview du dock), le choix est mémorisé', await until(page, () => !document.getElementById('station').classList.contains('p3d-on') && !!document.querySelector('#station .icpanel') && localStorage.getItem('carregie.poste3d') === '2d' && !window.__dbg.poste3d.P3D.active, null, 5000));
await page.click('#station .st-vue');
T.check('« Vue 3D » : retour devant le pupitre', await until(page, () => document.getElementById('station').classList.contains('p3d-on') && window.__dbg.poste3d.P3D.active, null, 5000));
await ev(() => window.__dbg.closeStation());
T.check('en quittant le poste, la caméra de la marche retrouve son cadrage (pas de décalage du centre optique)', await until(page, () => window.__dbg.S.mode === 'fps' && (!window.__dbg.pcam.view || !window.__dbg.pcam.view.enabled), null, 5000));
await shot('08-retour-car', 2000);
await T.finish();
