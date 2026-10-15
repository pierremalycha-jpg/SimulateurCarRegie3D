// Tests fonctionnels de la v3 : profil matériel, brassage, son, pannes, formateur, scénario, perf, IP / UHD / HDR
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/c77888a1-6f04-5876-a000-ab7e7f493575/scratchpad/v3';
const PART = process.argv[3] || 'all';
const VW = 1440, VH = 900;
fs.mkdirSync(OUT, { recursive: true });
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const three = fs.readFileSync('node_modules/three/build/three.module.min.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const log = (...a) => console.log(...a);
async function newPage(query = 'lite') {
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
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
const shotOf = (page) => async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); log('shot', n); };

if (PART === 'all' || PART === 'hd') {
  const page = await newPage();
  const ev = (f, a) => page.evaluate(f, a); const shot = shotOf(page);
  await shot('00-accueil');
  await ev(() => window.__dbg.start('standard', 'jour', 'basse', false));
  await page.waitForTimeout(4000);
  for (const id of ['melangeur', 'realisateur', 'scripte', 'habillage', 'producteur', 'chefdecar', 'vision', 'evs', 'ipdirector', 'son', 'hf', 'grille', 'ccu', 'synchro', 'transmission', 'intercom', 'brassage']) {
    await ev((id) => { window.__dbg.closeStation(); window.__dbg.openStation(id); }, id);
    await page.waitForTimeout(600);
    const r = await ev(() => ({ open: !!document.querySelector('#station:not([hidden])'), slots: document.querySelectorAll('#station [data-gl]').length, ex: !!document.querySelector('#station .explain') }));
    log('station', id, JSON.stringify(r));
  }
  // ---- son ----
  await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('son'); });
  await page.waitForTimeout(1200);
  const strip = page.locator('.strip').filter({ hasText: 'Consultant' });
  await strip.locator('button', { hasText: 'INTL' }).click();
  log('comm2 intl after click (true = erreur signalée)', await ev(() => window.__dbg.AU.ch.comm2.intl), await ev(() => document.querySelector('.ex-item .ex-t')?.textContent.slice(0, 80)));
  await strip.locator('button', { hasText: 'INTL' }).click();
  await page.locator('button', { hasText: '+ 1 image' }).click(); await page.locator('button', { hasText: '+ 1 image' }).click();
  log('lineDelay', await ev(() => window.__dbg.AU.lineDelay), 'effDelay', await ev(() => window.__dbg.AU.effDelay));
  await page.locator('.hwpanel select').first().selectOption('intl');
  log('emb', await ev(() => window.__dbg.AU.emb.join(',')));
  await page.locator('.hw', { hasText: 'N-1' }).first().click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.locator('#station .st-dock button', { hasText: 'N-1' }).click();
  log('monitor', await ev(() => window.__dbg.AU.monitor));
  await page.waitForTimeout(800);
  await shot('10-son');
  await page.locator('.hwpanel select').first().selectOption('pgm');
  await page.locator('button', { hasText: '− 1 image' }).click(); await page.locator('button', { hasText: '− 1 image' }).click();
  // ---- pannes son ----
  for (const id of ['n1echo', 'avsync', 'emb']) {
    const e = await ev((id) => { const x = window.__dbg.injectFault(id); return !!x; }, id);
    await page.waitForTimeout(300);
    log('fault', id, 'injected', e, 'emb', await ev(() => window.__dbg.AU.emb.join(',')), 'delay', await ev(() => window.__dbg.AU.lineDelay));
  }
  await page.waitForTimeout(600);
  await shot('11-son-pannes');
  // réparation par l'interface
  await strip.locator('button', { hasText: 'N-1' }).click();
  await page.locator('.hwpanel select').nth(0).selectOption('pgm');
  await page.locator('.hwpanel select').nth(1).selectOption('intl');
  for (let i = 0; i < 12; i++) { if (await ev(() => window.__dbg.AU.lineDelay) <= 40) break; await page.locator('button', { hasText: '− 1 image' }).click(); }
  await page.waitForTimeout(1500);
  log('faults after fix', await ev(() => window.__dbg.ACTIVE.filter((a) => ['n1echo', 'avsync', 'emb'].includes(a.f.id)).map((a) => a.f.id + ':' + a.done).join(' ')));
  // ---- transmission ----
  await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('transmission'); });
  await page.waitForTimeout(800);
  log('tx rows', await ev(() => [...document.querySelectorAll('#station .kv dt')].map((d) => d.textContent + '=' + d.nextSibling.textContent.slice(0, 50)).join(' | ')));
  // ---- mélangeur, EVS, IPDirector, brassage ----
  for (const [id, n] of [['melangeur', '20-melangeur'], ['evs', '21-evs'], ['ipdirector', '22-ipdirector'], ['brassage', '23-brassage'], ['chefdecar', '24-chefdecar'], ['vision', '25-vision']]) {
    await ev((id) => { window.__dbg.closeStation(); window.__dbg.openStation(id); }, id);
    await page.waitForTimeout(1500); await shot(n);
  }
  // vision : HDR
  const hdr = page.locator('#station button', { hasText: /SDR.*HDR|SDR \| HDR/ }).first();
  if (await hdr.count()) { await hdr.click(); await page.waitForTimeout(1500); await shot('26-vision-sdrhdr'); log('hdrView', await ev(() => window.__dbg.S.hdrView)); } else log('NO HDR BUTTON');
  await ev(() => window.__dbg.closeStation());
  // ---- espace formateur ----
  await ev(() => window.__dbg.openTrainer('car'));
  await page.waitForTimeout(600); await shot('30-formateur-car');
  for (const [k, n] of [['cables', '31-cables'], ['proc', '32-proc'], ['photos', '33-photos'], ['eleves', '34-eleves'], ['review', '35-review']]) {
    await page.locator('#modal .tab[data-k="' + k + '"]').click(); await page.waitForTimeout(500);
    if (k === 'cables') {
      const csv = 'N°;Origine;Destination;Câble;Longueur;Signal;Remarque\n1;CAM 1 (tribune);Baie CCU 1;Fibre SMPTE 311;180;Hybride;Touret 1\n2;CCU 1 SDI 1;Grille IN 1;Coax 1694A;3;3G-SDI;\n3;SPG Black OUT 1;CCU 1 REF;Coax;2;Ref;tri-level';
      fs.writeFileSync(OUT + '/test.csv', csv);
      await page.locator('#modal input[type=file]').setInputFiles(OUT + '/test.csv');
      await page.waitForTimeout(500);
      await page.locator('#modal button', { hasText: 'Enregistrer la liste' }).click();
      await page.waitForTimeout(500);
      log('cabling saved', await ev(() => window.__dbg.CFG.cabling && window.__dbg.CFG.cabling.rows.length));
    }
    await shot(n);
  }
  await ev(() => document.querySelector('#modal .x').click());
  // chef de car : liste importée
  await ev(() => { window.__dbg.openStation('chefdecar'); });
  await page.waitForTimeout(800);
  await page.locator('#station .tab[data-k="cables"]').click(); await page.waitForTimeout(500);
  await shot('36-chef-cables-importes');
  log('chef imported rows visible', await ev(() => document.querySelector('#station').textContent.includes('Touret 1')));
  await ev(() => window.__dbg.closeStation());
  // ---- perf ----
  await ev(() => window.__dbg.emit('perfTest'));
  await page.waitForTimeout(7500);
  log('perf modal', await ev(() => document.querySelector('#modal h2')?.textContent), await ev(() => JSON.stringify(window.__dbg.SH && null)));
  await shot('40-perf');
  await ev(() => document.querySelector('#modal .x')?.click());
  // ---- guide : réglages / relecture ----
  await ev(() => window.__dbg.openGuide && window.__dbg.openGuide());
  await page.waitForTimeout(500); await shot('41-guide');
  await ev(() => document.querySelector('#modal .x')?.click());
  await page.close();
}

if (PART === 'all' || PART === 'scenario') {
  const page = await newPage();
  const ev = (f, a) => page.evaluate(f, a); const shot = shotOf(page);
  await ev(() => window.__dbg.start('scenario', 'jour', 'basse', false));
  await page.waitForFunction(() => window.__dbg.SC.on, null, { timeout: 30000 }).catch(() => {});
  log('scenario', await ev(() => JSON.stringify({ on: window.__dbg.SC.on, phase: window.__dbg.SC.phase, emb: window.__dbg.AU.emb })));
  await shot('50-scenario');
  // brasser automatiquement pour passer à la phase suivante
  await ev(() => { const P = window.__dbg.S.patch; window.__dbg.emit('debugPatchNormal'); });
  await page.waitForTimeout(500);
  await page.close();
}

if (PART === 'all' || PART === 'ip') {
  const page = await newPage();
  const ev = (f, a) => page.evaluate(f, a); const shot = shotOf(page);
  await ev(() => window.__dbg.start('standard', 'jour', 'basse', false, 'UHD', true));
  await page.waitForTimeout(4500);
  log('ip mode', await ev(() => JSON.stringify({ ip: window.__dbg.S.ipMode, fmt: window.__dbg.S.format })));
  for (const id of ['grille', 'synchro', 'melangeur', 'evs', 'vision']) {
    await ev((id) => { window.__dbg.closeStation(); window.__dbg.openStation(id); }, id);
    await page.waitForTimeout(1500); await shot('60-ip-' + id);
  }
  for (const id of ['ipred', 'ipgm', 'ipnmos', 'ipmv']) { await ev((id) => window.__dbg.injectFault(id), id); }
  await page.waitForTimeout(4500);
  log('NET', await ev(() => JSON.stringify(window.__dbg.NET)));
  await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('grille'); });
  await page.waitForTimeout(1500); await shot('61-ip-pannes-grille');
  await page.close();
}


if (PART === 'ops') {
  const page = await newPage();
  const ev = (f, a) => page.evaluate(f, a); const shot = shotOf(page);
  await ev(() => window.__dbg.start('standard', 'jour', 'basse', false));
  await page.waitForTimeout(9000); // laisser l'EVS enregistrer
  // ---- LSM ----
  await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('evs'); });
  await page.waitForTimeout(1200);
  const key = (t) => page.locator('.lsm-key', { hasText: new RegExp('^' + t) }).first().click();
  await key('DERN. ACTION'); await page.waitForTimeout(300);
  await key('IN'); await page.waitForTimeout(1500);
  await key('OUT'); await page.waitForTimeout(300);
  log('lsm in/out', await ev(() => JSON.stringify({ in: window.__dbg.EVS.ch[0].in, out: window.__dbg.EVS.ch[0].out })));
  await key('F1'); await page.waitForTimeout(300);
  log('clips', await ev(() => window.__dbg.EVS.clips.length));
  await key('SHIFT'); await key('IN'); await page.waitForTimeout(300);
  await key('PLAY'); await page.waitForTimeout(1200);
  log('playing', await ev(() => JSON.stringify({ p: window.__dbg.EVS.ch[0].playing, mode: window.__dbg.EVS.ch[0].mode, t: window.__dbg.EVS.ch[0].t })));
  await key('RETURN'); await page.waitForTimeout(300);
  await key('PGM1'); await key('TAKE'); await page.waitForTimeout(300);
  log('after take', await ev(() => JSON.stringify(window.__dbg.EVS.ch.map((c) => [c.mode, c.playing]))));
  await key('PGM2'); await page.waitForTimeout(200);
  await key('LIVE'); await page.waitForTimeout(300);
  log('live', await ev(() => window.__dbg.EVS.ch[0].mode));
  await shot('70-lsm');
  // ---- IPDirector ----
  await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('ipdirector'); });
  await page.waitForTimeout(1000);
  await page.locator('#station button', { hasText: /^BUT$/ }).first().click().catch((e) => log('no BUT kw', e.message.slice(0, 60)));
  await page.waitForTimeout(300);
  const toClip = page.locator('#station button', { hasText: '→ Clip' }).first();
  if (await toClip.count()) { await toClip.click(); await page.waitForTimeout(300); }
  log('ipd logs/clips', await ev(() => JSON.stringify({ logs: window.__dbg.EVS.logs.length, clips: window.__dbg.EVS.clips.length })));
  await shot('71-ipd');
  // ---- mélangeur ----
  await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('melangeur'); });
  await page.waitForTimeout(1000);
  await page.locator('.xpt.pst').nth(2).click(); await page.waitForTimeout(200);
  await page.locator('.hw', { hasText: /^CUT$/ }).first().click(); await page.waitForTimeout(400);
  log('mixer after CUT', await ev(() => JSON.stringify({ pgm: window.__dbg.MIX.pgm, pst: window.__dbg.MIX.pst })));
  await page.locator('.xpt.pst').nth(4).click();
  await page.locator('.hw', { hasText: 'AUTO TRANS' }).first().click(); await page.waitForTimeout(2500);
  log('mixer after AUTO', await ev(() => JSON.stringify({ pgm: window.__dbg.MIX.pgm, pst: window.__dbg.MIX.pst })));
  await shot('72-mixer');
  // ---- brassage ----
  await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('brassage'); });
  await page.waitForTimeout(1000); await shot('73-brassage');
  await page.close();
}
log('ERRORS', errors.length); for (const e of errors.slice(0, 15)) log(e.slice(0, 400));
await browser.close();
