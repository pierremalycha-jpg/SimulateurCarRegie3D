// Grille du car SDI façon Videohub 40 × 40 12G : façade (OUT, IN, TAKE, molette), logiciel Videohub
// Control (TAKE, verrou), monitoring vivant des 40 entrées et 40 sorties (l'image change d'une capture
// à l'autre), matrice, Videohub Setup (étiquettes, protocole), poste Transmission bloqué par le verrou,
// pannes de la grille, parcours du chef de car rejoués par son panneau, accessibilité de chaque onglet
// (axe-core), et car IP qui garde son contrôleur NMOS.
// node tests/e2e/videohub.mjs [dossier]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('videohub');
const T = reporter();
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const browser = await launch();
const page = await openPage(browser, { viewport: { width: 1440, height: 900 }, errors: T.errors });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }); T.log('shot', n); };
const click = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(250); };
const R = () => ev(() => window.__dbg.ROUTER.map);
const tab = async (k) => { await click(`#station .tabs .tab[data-k="${k}"]`); await page.waitForTimeout(300); };
const lastExplain = () => ev(() => document.querySelector('#station .ex-list .ex-item .ex-t')?.textContent || '');

await ev(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } window.__dbg.start('standard', 'jour', 'basse', false, 'HD', false); });
T.check('partie lancée (car SDI)', await until(page, () => window.__dbg.S.mode === 'fps' && !window.__dbg.S.ipMode, null, 90000));
await page.waitForTimeout(2000);
await ev(() => window.__dbg.openStation('grille'));
T.check('poste Grille : la façade de la Videohub', await until(page, () => !!document.querySelector('#station .vh-face .vh-lcd [data-gl="VH:LCD"]'), null, 20000));
T.check('Videohub Control : 40 destinations et 40 sources', await ev(() => document.querySelectorAll('#station .vh-dest button[data-out]').length === 40 && document.querySelectorAll('#station .vh-src button[data-in]').length === 40));
T.check('étiquettes du car et sorties libres (« Input 30 »)', await ev(() => document.querySelector('#station .vh-dest button[data-out="31"]').textContent.includes('TX1 FIBRE') && document.querySelector('#station .vh-src button[data-in="30"]').textContent.includes('Input 30')));
T.check('fil d\'explications : présentation de la Videohub', await until(page, () => [...document.querySelectorAll('#station .ex-item')].some((e) => /Videohub 40×40 12G/.test(e.textContent)), null, 20000));
await shot('01-poste');

// ---- façade : OUT 3 3, IN 4, TAKE ----
const cam = await ev(() => { const ids = window.__dbg.S.cams.filter((c) => !c.rf && c.id <= 9).map((c) => c.id); return [4, 3, 5, 2].find((i) => ids.includes(i)) || ids[0]; });
await click('#station .vh-face [data-fp="out"]');
// deux chiffres tapés à la suite (le rendu logiciel est trop lent pour deux clics espacés)
await ev(() => { const k = document.querySelector('#station .vh-face [data-fp="d3"]'); k.click(); k.click(); });
T.check('façade : sortie 33 choisie, l\'écran affiche son étiquette', await until(page, () => /33\s*ÉCRAN GÉANT/.test(document.querySelector('#station .vh-lcdrow').textContent), null, 20000), await ev(() => document.querySelector('#station .vh-lcdrow').textContent));
await click('#station .vh-face [data-fp="in"]');
await click(`#station .vh-face [data-fp="d${cam}"]`);
T.check('façade : source préparée, TAKE clignote, rien n\'est commuté', await until(page, () => document.querySelector('#station .vh-face [data-fp="take"]').classList.contains('blink'), null, 20000) && (await R()).AUX_GIANT !== 'CAM' + cam);
await shot('02-facade-take');
await click('#station .vh-face [data-fp="take"]');
T.check('façade : TAKE établit le point de croisement', await until(page, (c) => window.__dbg.ROUTER.map.AUX_GIANT === 'CAM' + c, cam, 20000));
// molette au clavier : un cran = un port
await page.locator('#station .vh-knob').focus();
await page.keyboard.press('ArrowUp');
T.check('molette : la sortie suivante (34)', await until(page, () => /34\s*GRADE 1/.test(document.querySelector('#station .vh-lcdrow').textContent), null, 20000));
await page.keyboard.press('ArrowDown');

// ---- logiciel : TAKE, puis verrou ----
await tab('control');
await click('#station .vh-dest button[data-out="35"]');
await click(`#station .vh-src button[data-in="${cam}"]`);
T.check('Videohub Control : la source clignote, TAKE armé, la sortie n\'a pas bougé', await until(page, (c) => !!document.querySelector(`#station .vh-src button[data-in="${c}"].pend`) && document.querySelector('#station .vh-take').classList.contains('armed') && window.__dbg.ROUTER.map.MV13 !== 'CAM' + c, cam, 20000));
await click('#station .vh-take');
T.check('TAKE : MV 13 reçoit la caméra (une entrée vers deux sorties)', await until(page, (c) => window.__dbg.ROUTER.map.MV13 === 'CAM' + c && document.querySelector(`#station .vh-src button[data-in="${c}"]`).textContent.includes('2 sorties'), cam, 20000));
T.check('explication du point de croisement', /Point de croisement établi/.test(await lastExplain()), await lastExplain());
await click('#station .vh-dest button[data-out="31"]');
await click('#station .vh-lockbtn');
T.check('sortie 31 verrouillée (état O)', await until(page, () => window.__dbg.ROUTER.vh.locks[31] === 'O' && !!document.querySelector('#station .vh-dest button[data-out="31"] .vh-lk.own'), null, 20000));
await click('#station .vh-src button[data-in="22"]');
T.check('mire sur la sortie verrouillée : refusée, le départ garde le PGM', (await R()).AUX_TX1 === 'PGM' && await until(page, () => /verrouillée/.test(document.querySelector('#station .ex-list .ex-item .ex-t')?.textContent || ''), null, 20000), await lastExplain());
await shot('03-control-verrou');

// ---- monitoring : les vignettes vivent ----
await tab('mon');
T.check('monitoring : deux mosaïques de 40 vignettes', await ev(() => document.querySelectorAll('#station .vh-hit.in button').length === 40 && document.querySelectorAll('#station .vh-hit.out button').length === 40));
await page.waitForTimeout(5000);
const stats = async () => {
  const buf = await page.locator('#station .vh-mos.in .vh-mosbox').screenshot();
  return ev(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = 128; c.height = 65; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 128, 65);
    const d = g.getImageData(0, 0, 128, 65).data; let lit = 0, green = 0; const px = [];
    for (let i = 0; i < d.length; i += 4) { const y = (d[i] + d[i + 1] + d[i + 2]) / 3; if (y > 40) lit++; if (d[i + 1] > d[i] + 25 && d[i + 1] > d[i + 2] + 25) green++; px.push(y | 0); }
    return { lit: lit / (d.length / 4), green: green / (d.length / 4), px };
  }, buf.toString('base64'));
};
const s1 = await stats();
T.check('mosaïque des entrées : des images (pelouse) et pas un écran noir', s1.lit > 0.3 && s1.green > 0.05, `éclairés ${Math.round(s1.lit * 100)} %, vert ${Math.round(s1.green * 100)} %`);
await page.waitForTimeout(4000);
const s2 = await stats();
const diff = s1.px.reduce((a, v, i) => a + (Math.abs(v - s2.px[i]) > 12 ? 1 : 0), 0) / s1.px.length;
T.check('les vignettes sont vivantes (l\'image change)', diff > 0.01, `${Math.round(diff * 1000) / 10} % de pixels changés`);
await click('#station .vh-hit.out button[data-out="33"]');
T.check('clic sur une vignette de sortie : elle devient la destination choisie', await until(page, () => /Monitoring, sortie 33/.test(document.querySelector('#station .ex-list .ex-item .ex-t')?.textContent || ''), null, 20000), await lastExplain());
await shot('04-monitoring');

// ---- matrice et Videohub Setup ----
await tab('mx');
T.check('matrice dessinée', await until(page, () => { const c = document.querySelector('#station canvas.vh-mx'); if (!c || !c.offsetParent) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i + 2] > 180 && d[i + 1] > 150) n++; return n > 20; }, null, 20000));
await shot('05-matrice');
await tab('setup');
const lab = page.locator('#station .vh-setup input[aria-label="Étiquette de l\'entrée 3"]');
await lab.fill('CAM TEST'); await lab.press('Enter'); await page.waitForTimeout(800);
T.check('étiquette modifiée : elle part dans le protocole (port 2, numérotation à partir de 0)', await until(page, () => /INPUT LABELS:[\s\S]*\n2 CAM TEST\n/.test(document.querySelector('#station .vh-proto').textContent), null, 20000));
T.check('… et le logiciel l\'affiche', await until(page, () => document.querySelector('#station .vh-src button[data-in="3"]').textContent.includes('CAM TEST'), null, 20000));
T.check('protocole : verrou de la sortie 31 (ligne « 30 O ») et routage « 30 23 »', await until(page, () => { const t = document.querySelector('#station .vh-proto').textContent; return /\n30 O\n/.test(t) && /VIDEO OUTPUT ROUTING:[\s\S]*\n30 23\n/.test(t); }, null, 20000));
await click('#station .vh-setup button:has-text("Rétablir les étiquettes du car")');
T.check('étiquettes du car rétablies', await ev(() => !Object.keys(window.__dbg.ROUTER.vh.labels.in).length));
await shot('06-setup');

// ---- le poste Transmission ne passe plus la mire sur un départ verrouillé ----
await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('transmission'); });
await page.waitForTimeout(800);
await click('#station button.hw:has-text("ENVOYER LA MIRE")');
T.check('Transmission : mire refusée, message de verrou', (await R()).AUX_TX1 === 'PGM' && await until(page, () => /verrouillée/.test(document.querySelector('#station .ex-list .ex-item .ex-t')?.textContent || ''), null, 20000), await lastExplain());
await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('grille'); });
await page.waitForTimeout(800);
await tab('control');
await click('#station .vh-dest button[data-out="31"]');
await click('#station .vh-lockbtn');
T.check('sortie 31 déverrouillée', await until(page, () => !window.__dbg.ROUTER.vh.locks[31], null, 20000));

// ---- pannes de la grille ----
await ev(() => { window.__dbg.injectFault('vhlock'); });
T.check('panne : écran géant sur la mire, sortie 33 verrouillée par un autre poste', await until(page, () => window.__dbg.ROUTER.map.AUX_GIANT === 'BARS' && window.__dbg.ROUTER.vh.locks[33] === 'L' && !!document.querySelector('#station .vh-dest button[data-out="33"] .vh-lk.other'), null, 20000));
await click('#station .vh-dest button[data-out="33"]');
await click('#station .vh-lockbtn');
T.check('forcer un verrou d\'un autre poste : confirmation dans la page', await until(page, () => !!document.querySelector('#ask [data-ask="ok"]'), null, 20000));
await page.locator('#ask [data-ask="ok"]').click(); await page.waitForTimeout(300);
await click('#station .vh-src button[data-in="25"]'); await click('#station .vh-take');
T.check('panne réparée (écran géant au clean feed)', await until(page, () => window.__dbg.ACTIVE.filter((a) => a.f.id === 'vhlock').every((a) => a.done), null, 30000));
await ev(() => window.__dbg.clearFaults());

// ---- accessibilité de chaque onglet (axe-core, défauts graves) ----
await page.addScriptTag({ content: AXE });
for (const k of ['control', 'mon', 'mx', 'setup']) {
  await tab(k); await page.waitForTimeout(400);
  const v = await ev(async () => (await window.axe.run({ include: [['#station']], exclude: [['canvas']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.filter((x) => x.impact === 'critical' || x.impact === 'serious').map((x) => `${x.id} ×${x.nodes.length} ${x.nodes[0].target.join(' ')}`));
  T.check(`accessibilité (axe) : onglet ${k} sans défaut grave`, !v.length, v.join(' | '));
}

// ---- parcours du chef de car, par son panneau ----
await ev(() => window.__dbg.closeStation());
const cur = () => ev(() => { const X = window.__dbg.TUTOR; const s = X.lesson && X.lesson.steps[X.i]; return s ? { id: s.id, done: X.done, quiz: s.quiz ? s.quiz.answer : null, act: !!s.done, show: !!s.show } : null; });
for (const id of ['videohub-routage', 'videohub-verrou', 'grille-routage']) {
  await ev((i) => { window.__dbg.toggleChef(true); window.__dbg.startChefLesson(i); }, id);
  const done = []; let stuck = null; const misses = [];
  for (let k = 0; k < 30; k++) {
    const s = await cur(); if (!s) break;
    if (s.quiz != null && !s.done) { await page.locator('#chef .chef-choice').nth(s.quiz).click(); await page.waitForTimeout(200); }
    else if (s.act && !s.done) {
      const b = page.locator('#chef button', { hasText: /Emmène-moi|Montre-moi/ }).first();
      if (s.show && await b.count()) {
        await b.click(); await page.waitForTimeout(400);
        if (await b.count()) await b.click().catch(() => {});
        if (!(await until(page, () => { const sp = document.getElementById('chef-spot'); return (sp && !sp.hidden) || window.__dbg.TUTOR.done; }, null, 6000))) misses.push(s.id);
      }
      if (!(await ev(() => window.__dbg.TUTOR.done))) await ev(() => window.__dbg.chefDoForMe());
      if (!(await until(page, () => window.__dbg.TUTOR.done, null, 30000))) { stuck = s.id; break; }
    }
    done.push(s.id);
    await ev(() => window.__dbg.chefNext()); await page.waitForTimeout(150);
  }
  const fin = await ev((i) => !!(window.__dbg.PROG.tutor[i] && window.__dbg.PROG.tutor[i].done) && !window.__dbg.TUTOR.lesson, id);
  T.check(`parcours ${id}`, !stuck && fin, `${stuck ? 'bloqué à « ' + stuck + ' » après ' : ''}${done.join(' → ')}`);
  T.check(`parcours ${id} : « Emmène-moi / Montre-moi » trouve l'élément`, !misses.length, misses.join(', '));
  if (stuck) { await shot('bloque-' + id); await ev(() => window.__dbg.stopChefLesson && window.__dbg.stopChefLesson()); }
  await ev(() => { if (window.__dbg.S.mode === 'station') window.__dbg.closeStation(); });
}
T.check('après les parcours : départs libres, pas de panne en cours', await ev(() => !window.__dbg.ROUTER.vh.locks[31] && !window.__dbg.ROUTER.vh.locks[32] && window.__dbg.ACTIVE.every((a) => a.done)));
await ev(() => window.__dbg.toggleChef(false));

// ---- car IP : le contrôleur NMOS reste en place ----
await page.close();
const ip = await openPage(browser, { viewport: { width: 1440, height: 900 }, errors: T.errors });
await ip.evaluate(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } window.__dbg.start('standard', 'jour', 'basse', false, 'HD', true); });
T.check('partie lancée en car IP', await until(ip, () => window.__dbg.S.mode === 'fps' && window.__dbg.S.ipMode && !!window.__dbg.FAB.res, null, 90000));
await ip.evaluate(() => window.__dbg.openStation('grille'));
await ip.waitForTimeout(1200);
T.check('car IP : contrôleur NMOS (pas de Videohub)', await ip.evaluate(() => !document.querySelector('#station .vh-face') && !!document.querySelector('#station button.hw[data-d="ME1"]') && /CONNECT/.test(document.querySelector('#station').textContent)));
await ip.screenshot({ path: `${OUT}/07-ip.png` });
await T.finish();
