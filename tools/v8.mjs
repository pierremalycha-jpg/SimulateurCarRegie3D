// Tests de la v8 : commutation clavier, plan proche, console son façon Vista, commentaires, caméras
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/c77888a1-6f04-5876-a000-ab7e7f493575/scratchpad/v8';
const PART = process.argv[3] || 'all';
fs.mkdirSync(OUT, { recursive: true });
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const three = fs.readFileSync('node_modules/three/build/three.module.min.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const log = (...a) => console.log(...a);
let fails = 0;
const check = (name, ok, extra = '') => { if (!ok) fails++; log(ok ? 'OK  ' : 'FAIL', name, extra); };
async function newPage(query = 'lite', vw = 1440, vh = 900) {
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: three, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
  await page.route('http://local.test/**', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
  await page.goto('http://local.test/?' + query);
  await page.waitForTimeout(2500);
  return page;
}
const shotOf = (page) => async (n) => { await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }); log('shot', n); };

if (PART === 'all' || PART === 'keys') {
  const page = await newPage();
  const ev = (f, a) => page.evaluate(f, a); const shot = shotOf(page);
  await ev(() => window.__dbg.start('standard', 'jour', 'basse', false));
  await page.waitForTimeout(3000);
  await ev(() => localStorage.removeItem('carregie.keymode'));
  // FPS : chiffre = commutation directe
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(300);
  check('FPS Digit3 -> PGM 3', await ev(() => window.__dbg.MIX.pgm) === 3);
  check('bandeau de confirmation affiché', await ev(() => { const o = document.querySelector('#commut-osd'); return !!o && o.classList.contains('pgm') && o.textContent.includes('CAM'); }));
  check('minimon visible', await ev(() => !document.querySelector('#minimon').hidden));
  await shot('k1-fps-osd');
  await page.keyboard.press('Shift+Digit5');
  check('FPS Shift+Digit5 (AZERTY) -> PGM 5', await ev(() => window.__dbg.MIX.pgm) === 5);
  await page.keyboard.press('Numpad2');
  check('Numpad2 -> PGM 2', await ev(() => window.__dbg.MIX.pgm) === 2);
  await page.keyboard.press('KeyB');
  await page.keyboard.press('Digit4');
  check('mode preset : Digit4 -> PST 4, PGM inchangé', await ev(() => window.__dbg.MIX.pst === 4 && window.__dbg.MIX.pgm === 2));
  await page.keyboard.press('Enter');
  check('Entrée -> CUT (PGM 4)', await ev(() => window.__dbg.MIX.pgm) === 4);
  await page.keyboard.press('KeyB');
  // vol : plan proche reculé
  await ev(() => window.__dbg.teleport(13));
  await page.waitForTimeout(500);
  const near = await ev(() => window.__dbg.pcam ? window.__dbg.pcam.near : null);
  log('near en vol', near);
  // poste réalisateur
  await ev(() => window.__dbg.openStation('realisateur'));
  await page.waitForTimeout(500);
  await page.keyboard.press('Digit6');
  check('réalisateur Digit6 -> PGM 6', await ev(() => window.__dbg.MIX.pgm) === 6);
  // poste vision (repli) : chiffres commutent aussi
  await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('vision'); });
  await page.waitForTimeout(500);
  await page.keyboard.press('Digit1');
  check('vision Digit1 -> PGM 1', await ev(() => window.__dbg.MIX.pgm) === 1);
  // mélangeur : clic sur un bouton puis Espace ne doit pas recliquer
  await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('melangeur'); });
  await page.waitForTimeout(600);
  await page.locator('button.xpt.pst').nth(1).click();
  await page.keyboard.press('KeyB');
  await page.keyboard.press('Digit3');
  check('mélangeur preset Digit3 -> PST 3', await ev(() => window.__dbg.MIX.pst) === 3);
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  check('mélangeur Espace -> CUT (PGM 3)', await ev(() => window.__dbg.MIX.pgm) === 3, await ev(() => `pgm ${window.__dbg.MIX.pgm} pst ${window.__dbg.MIX.pst}`));
  await shot('k2-mixer');
  await page.close();
}

if (PART === 'all' || PART === 'audio') {
  const page = await newPage('');
  const ev = (f, a) => page.evaluate(f, a); const shot = shotOf(page);
  await ev(() => window.__dbg.start('standard', 'jour', 'basse', true));
  await page.waitForTimeout(5000);
  const lv = () => ev(() => { const A = window.__dbg.AU; const o = {}; for (const k of A.order) o[k] = Math.round(A.ch[k].peak); o.L = Math.round(A.master.peakL); o.R = Math.round(A.master.peakR); o.lufsS = Math.round(A.lufs.s); o.corr = +A.corr.toFixed(2); return o; });
  log('niveaux', JSON.stringify(await lv()));
  const l0 = await lv();
  check('ambiances présentes', l0.amb1 > -40 && l0.amb2 > -40, `${l0.amb1} ${l0.amb2}`);
  check('PGM présent', l0.L > -40, String(l0.L));
  check('corrélation positive', l0.corr > 0.2, String(l0.corr));
  await ev(() => window.__dbg.openStation('son'));
  await page.waitForTimeout(1500);
  await shot('a1-console');
  check('20 tranches Vistonics', await ev(() => document.querySelectorAll('.vx-strip').length) === 20);
  // vue égaliseur
  await page.locator('.vx-bar button', { hasText: 'ÉGALISEUR' }).click();
  await page.waitForTimeout(500);
  await shot('a2-eq');
  await page.locator('.vx-bar button', { hasText: 'DYNAMIQUE' }).click();
  await page.waitForTimeout(500);
  await shot('a3-dyn');
  await page.locator('.vx-bar button', { hasText: 'PAN' }).click();
  await page.waitForTimeout(400);
  // erreur de départ : consultant dans l'INTL
  const comm2 = page.locator('.vx-strip').filter({ hasText: 'COMM 2' });
  await comm2.locator('.vb', { hasText: 'INTL' }).click();
  check('INTL comm2 -> erreur signalée', await ev(() => window.__dbg.AU.ch.comm2.intl) === true && (await ev(() => document.querySelector('.ex-item .ex-t')?.textContent || '')).includes('ERREUR'));
  await comm2.locator('.vb', { hasText: 'INTL' }).click();
  // molette gain : glisser vers le haut (vue entrée)
  await page.locator('.vx-bar button', { hasText: 'ENTRÉE' }).click();
  await page.waitForTimeout(300);
  const c3 = page.locator('.vx-strip').filter({ hasText: 'CANON 3' });
  const dial = c3.locator('.vk-dial').first();
  const bb = await dial.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x + bb.width / 2, bb.y - 60, { steps: 5 }); await page.mouse.up();
  const g3 = await ev(() => window.__dbg.AU.ch.c3.gain);
  check('molette GAIN canon 3 augmente', g3 > 50, String(g3));
  await ev(() => { const c = window.__dbg.AU.ch.c3; c.gain = c.defGain; });
  // 48 V coupé -> silence sur le kop
  await ev(() => window.__dbg.injectFault('ph48'));
  await page.waitForTimeout(1500);
  const r48 = await ev(() => window.__dbg.stripRms('amb2'));
  check('48V coupé : AMB KOP muet', r48 < -70, String(r48));
  await page.locator('.vx-strip').filter({ hasText: 'AMB KOP' }).locator('.vb', { hasText: '48V' }).click();
  await page.waitForTimeout(1500);
  check('48V rétabli', await ev(() => window.__dbg.stripRms('amb2')) > -50);
  // phase : corrélation négative
  await ev(() => window.__dbg.injectFault('phase'));
  await ev(() => { const A = window.__dbg.AU; A.ch.amb2.mute = true; for (let i = 1; i <= 6; i++) A.ch['c' + i].mute = true; A.ch.comm1.mute = true; A.ch.comm2.mute = true; A.ch.hfmic.mute = true; window.__dbg.AU.autoCanon = false; });
  await page.waitForTimeout(300);
  await ev(() => window.__dbg.applyAudio && window.__dbg.applyAudio());
  await page.waitForTimeout(2500);
  const cn = await ev(() => window.__dbg.corrNow());
  log('corr avec phase inversée', cn);
  check('corrélation négative (phase)', cn < -0.2, String(cn));
  await shot('a4-phase');
  await ev(() => { const A = window.__dbg.AU; A.ch.amb1.phase = false; A.ch.amb2.mute = false; for (let i = 1; i <= 6; i++) A.ch['c' + i].mute = false; A.ch.comm1.mute = false; A.ch.comm2.mute = false; A.ch.hfmic.mute = false; A.autoCanon = true; window.__dbg.applyAudio(); });
  // PFL : l'écoute bascule
  await page.locator('.vx-strip').filter({ hasText: 'CANON 1' }).locator('.vb', { hasText: 'PFL' }).click();
  check('PFL actif', await ev(() => window.__dbg.AU.pflActive));
  await page.locator('.vx-strip').filter({ hasText: 'CANON 1' }).locator('.vb', { hasText: 'PFL' }).click();
  // couche B
  await page.locator('.vx-bar button', { hasText: 'COUCHE B' }).click();
  await page.waitForTimeout(400);
  await shot('a5-layerB');
  check('couche B : masters et VCA', await ev(() => document.querySelectorAll('.vx-strip.m').length) === 9);
  await page.locator('.vx-bar button', { hasText: 'COUCHE A' }).click();
  // autres onglets
  for (const [t, n] of [['E/S et patch', 'a6-io'], ['Bus, N-1', 'a7-bus'], ['Snapshots', 'a8-snap'], ['Commentaires', 'a9-comm'], ['Comprendre', 'a10-vista']]) { await page.locator('.vx-tab', { hasText: t }).click(); await page.waitForTimeout(600); await shot(n); }
  // snapshot test de ligne : seule la mire
  await page.locator('.vx-tab', { hasText: 'Snapshots' }).click();
  await page.locator('.vx-snap').filter({ hasText: 'TEST DE LIGNE' }).locator('button', { hasText: 'RAPPELER' }).click();
  await page.waitForTimeout(1500);
  const lt = await lv();
  check('snapshot test de ligne : mire seule', !(await ev(() => window.__dbg.AU.ch.tone.mute)) && (await ev(() => window.__dbg.AU.ch.amb1.mute)), JSON.stringify(lt));
  log('PGM mire (attendu ≈ -18 dBFS crête)', lt.L);
  await page.locator('.vx-snap').filter({ hasText: 'MATCH' }).first().locator('button', { hasText: 'RAPPELER' }).click();
  // commentaires
  await page.waitForTimeout(8000);
  const cm = await ev(() => window.__dbg.CMT.log.map((l) => l.spk + ': ' + l.text).slice(-8));
  log('commentaires', JSON.stringify(cm));
  check('commentaires générés', cm.length > 0);
  // volume des voix selon la console
  const g1 = await ev(() => window.__dbg.voiceGain('comm1'));
  await ev(() => { window.__dbg.AU.ch.comm1.fader = -60; window.__dbg.applyAudio(); });
  const g2 = await ev(() => window.__dbg.voiceGain('comm1'));
  await ev(() => { window.__dbg.AU.ch.comm1.fader = 0; window.__dbg.setMonitor('intl'); });
  const g3b = await ev(() => window.__dbg.voiceGain('comm1'));
  await ev(() => window.__dbg.setMonitor('pgm'));
  check('voix suit la console (fader, bus)', g1 > 0.5 && g2 === 0 && g3b === 0, `${g1} ${g2} ${g3b}`);
  // pannes : patch, gain
  await ev(() => window.__dbg.injectFault('patch'));
  await page.locator('.vx-tab', { hasText: 'E/S et patch' }).click();
  await page.waitForTimeout(600);
  check('patch erroné visible', await ev(() => [...document.querySelectorAll('td.err')].some((t) => t.textContent.includes('MADI 1'))));
  await ev(() => window.__dbg.clearFaults());
  await page.waitForTimeout(500);
  await page.close();
}

if (PART === 'all' || PART === 'visual') {
  const page = await newPage('', 1280, 800);
  const ev = (f, a) => page.evaluate(f, a); const shot = shotOf(page);
  await ev(() => window.__dbg.start('standard', 'jour', 'moyenne', false));
  await page.waitForTimeout(4000);
  // regarder une caméra tribune (box) de près
  const look = async (id, dist, h, side, name) => {
    await ev(({ id, dist, h, side }) => {
      const D = window.__dbg; const c = D.S.cams.find((x) => x.id === id); const p = c.model ? c.model.root.position : c.cam.position;
      const yaw = c.yaw ? c.yaw.v : 0; const ang = yaw + side;
      D.PL.fly = true; D.S.inTruck = false;
      D.PL.pos.set(p.x + Math.sin(ang) * dist, p.y + h - 1.7, p.z + Math.cos(ang) * dist); D.PL.y = D.PL.pos.y + 1.7;
      D.PL.yaw = Math.atan2(-(p.x - D.PL.pos.x), -(p.z - D.PL.pos.z)); D.PL.pitch = Math.atan2(p.y - D.PL.y, Math.hypot(p.x - D.PL.pos.x, p.z - D.PL.pos.z));
    }, { id, dist, h, side });
    await page.waitForTimeout(1500); await shot(name);
  };
  const info = await ev(() => window.__dbg.S.cams.map((c) => `${c.id}:${c.T.model}:${c.L.name}`).join(' | '));
  log('caméras', info);
  await look(1, 2.6, 0.1, 2.3, 'v1-boxcam');
  await look(1, 2.2, 0.3, -0.6, 'v2-boxcam-back');
  const port = await ev(() => window.__dbg.S.cams.find((c) => c.T.model === 'shoulder')?.id);
  if (port) await look(port, 1.8, 0.2, 2.0, 'v3-shoulder');
  // console son 3D
  await ev(() => { const D = window.__dbg; const st = D.T.stations.find((s) => s.station === 'son'); D.goToStation(st, false); D.PL.pitch = -0.5; });
  await page.waitForTimeout(2000); await shot('v4-console3d');
  await ev(() => { const D = window.__dbg; D.PL.pos.x += 0.35; D.PL.pitch = -0.75; });
  await page.waitForTimeout(1500); await shot('v5-console3d-close');
  // vol au-dessus du stade
  await ev(() => window.__dbg.teleport(13));
  await page.waitForTimeout(2500); await shot('v6-aerien');
  await page.close();
}

if (PART === 'all' || PART === 'mobile') {
  const page = await newPage('lite', 400, 820);
  const ev = (f, a) => page.evaluate(f, a); const shot = shotOf(page);
  await ev(() => window.__dbg.start('standard', 'jour', 'basse', false));
  await page.waitForTimeout(3000);
  await ev(() => window.__dbg.openStation('son'));
  await page.waitForTimeout(1500);
  for (const t of ['Console', 'E/S et patch', 'Bus, N-1', 'Snapshots', 'Commentaires', 'Comprendre']) {
    await page.locator('.vx-tab', { hasText: t }).click(); await page.waitForTimeout(500);
    const w = await ev(() => [document.documentElement.scrollWidth, document.querySelector('#station').scrollWidth, window.innerWidth]);
    check('mobile 400 px sans débordement : ' + t, w[0] <= w[2] && w[1] <= w[2] + 1, w.join(' '));
  }
  await page.locator('.vx-tab', { hasText: 'Console' }).click(); await page.waitForTimeout(500);
  await shot('m1-son-mobile');
  await page.close();
}

if (PART === 'all' || PART === 'review') {
  const page = await newPage('lite');
  const ev = (f, a) => page.evaluate(f, a); const shot = shotOf(page);
  await page.locator('button', { hasText: 'Relecture technique (experts)' }).click();
  await page.waitForTimeout(600);
  await page.locator('.rv-dom button', { hasText: 'Vision' }).click();
  const n = await page.locator('.rv-card').count();
  check('relecture : points du domaine vision', n >= 5, String(n));
  await page.locator('.rv-card').first().locator('.rv-op', { hasText: 'À corriger' }).click();
  await page.locator('.rv-card').first().locator('textarea').fill('Valeur à vérifier sur notre car');
  await shot('r1-ma-relecture');
  await page.locator('#modal .tab', { hasText: 'Valeurs chiffrées' }).click();
  await page.waitForTimeout(400);
  const inp = page.locator('input[aria-label="Fujinon UA107x8.4BESM · Focale maxi"]');
  await inp.fill('880');
  await page.waitForTimeout(1500);
  await shot('r2-valeurs');
  await page.locator('#modal .tab', { hasText: 'Autres remarques' }).click();
  await page.locator('#modal textarea').fill('Chez nous le line-up se fait à 100 % de mire.');
  await page.locator('#modal button', { hasText: 'Ajouter la remarque' }).click();
  await page.locator('#modal .tab', { hasText: 'Synthèse' }).click();
  await page.waitForTimeout(800);
  await shot('r3-synthese');
  await page.locator('#modal .hw', { hasText: 'Valeurs proposées' }).click();
  await page.waitForTimeout(400);
  await page.locator('#modal button', { hasText: 'Appliquer' }).first().click();
  await page.waitForTimeout(800);
  const f = await ev(() => window.__dbg.CFG.review.overrides && window.__dbg.CFG.review.overrides['lens.UA107.fmax']);
  check('valeur appliquée (override enregistré)', f === 880, String(f));
  await shot('r4-applique');
  await page.locator('#modal .x').click();
  await ev(() => window.__dbg.start('standard', 'jour', 'basse', false));
  await page.waitForTimeout(2500);
  const fm = await ev(() => window.__dbg.S.cams.find((c) => c.lens === 'UA107')?.L.fmax);
  check('le simulateur utilise la valeur corrigée', fm === 880, String(fm));
  await page.close();
}

log('ERRORS', errors.length, errors.slice(0, 6).join('\n'));
log('FAILS', fails);
await browser.close();
