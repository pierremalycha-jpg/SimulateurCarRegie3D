// Postes et matériel : dock, moniteur flottant, RCP, LSM, visionneuse de matériel, câblage
// node tests/e2e/postes.mjs [dossier] [largeur] [hauteur]
import { launch, openPage, outDir } from './harness.mjs';
import fs from 'fs';
const OUT = outDir('postes');
const VW = +(process.argv[3] || 1440), VH = +(process.argv[4] || 900);
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
const errors = [];
const page = await openPage(browser, { viewport: { width: VW, height: VH }, errors });
await page.waitForTimeout(3000);
await page.evaluate(() => window.__dbg.start('standard', 'jour', 'basse', false));
await page.waitForTimeout(5000);
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('shot', n); };
const ev = (f, a) => page.evaluate(f, a);
const log = (...a) => console.log(...a);
const drag = async (sel, dx, dy) => { const b = await page.locator(sel).first().boundingBox(); if (!b) { log('NO BOX', sel); return; } const x = b.x + b.width / 2, y = b.y + b.height / 2; await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 }); await page.mouse.move(x + dx, y + dy, { steps: 4 }); await page.mouse.up(); };

// ---- tous les postes s'ouvrent sans erreur ----
for (const id of ['melangeur', 'realisateur', 'scripte', 'habillage', 'producteur', 'chefdecar', 'vision', 'evs', 'son', 'hf', 'grille', 'ccu', 'synchro', 'transmission', 'intercom']) {
  await ev((id) => { window.__dbg.closeStation(); window.__dbg.openStation(id); }, id);
  await page.waitForTimeout(700);
  const r = await ev(() => ({ dock: document.querySelector('.st-dock')?.children.length ?? -1, slots: document.querySelectorAll('#station [data-gl]').length, ex: !!document.querySelector('#station .explain'), bodyH: document.querySelector('.st-body').scrollHeight }));
  log('station', id, JSON.stringify(r));
}
// ---- vision : joystick, molettes, touches ----
await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('vision'); });
await page.waitForTimeout(1500);
const before = await ev(() => window.__dbg.S.cams[0].paint.iris);
await drag('.rjoy-handle', 0, -40);
const after = await ev(() => window.__dbg.S.cams[0].paint.iris);
log('iris', before, '->', after);
await drag('.rot.red .rot-cap', 0, -30);
log('wbR', await ev(() => window.__dbg.S.cams[0].paint.wbR));
await page.locator('.rcp-key', { hasText: 'KNEE' }).click();
log('kneeOn', await ev(() => window.__dbg.S.cams[0].paint.kneeOn));
await page.locator('.rcp-tab', { hasText: 'GAIN' }).click();
await page.locator('.rcp-touch', { hasText: '+6' }).click();
log('gain', await ev(() => window.__dbg.S.cams[0].paint.gain));
await page.locator('.rcp-btn', { hasText: 'BARS' }).click();
await page.waitForTimeout(1200);
await shot('v-vision');
await page.locator('.rcp-btn', { hasText: 'BARS' }).click();
await page.locator('.rcp-btn', { hasText: 'PANEL ACTIVE' }).click();
await drag('.rot.blue .rot-cap', 0, -30);
log('wbB locked (should stay)', await ev(() => window.__dbg.S.cams[0].paint.wbB));
await page.locator('.rcp-btn', { hasText: 'PANEL ACTIVE' }).click();
log('explain items', await ev(() => [...document.querySelectorAll('.ex-item .ex-t')].slice(0, 4).map((e) => e.textContent.slice(0, 90))));
// moniteur flottant
await page.locator('.st-head button', { hasText: 'Moniteur flottant' }).click();
await page.waitForTimeout(300);
await page.selectOption('#fmsrc', 'CAM2');
await page.waitForTimeout(1200);
await shot('v-floatmon');
// ---- EVS ----
await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('evs'); });
await page.waitForTimeout(1500);
log('floatmon removed', await ev(() => !document.getElementById('floatmon')));
await page.locator('.lsm-key', { hasText: /^IN(GOTO IN)?$/ }).click();
await page.waitForTimeout(300);
await page.locator('.lsm-key', { hasText: 'SHIFT' }).click();
await page.locator('.lsm-key', { hasText: /^F1(?![0-9])/ }).click();
await page.locator('.lsm-key', { hasText: 'SHIFT' }).click();
await page.locator('.lsm-key', { hasText: /^F2(?![0-9])/ }).click();
await page.locator('.lsm-key', { hasText: /^PLST(BROWSE)?$/ }).click();
await page.locator('.lsm-key', { hasText: /^F1(?![0-9])/ }).click();
await page.locator('.lsm-key', { hasText: /^F2(?![0-9])/ }).click();
log('clips', await ev(() => window.__dbg.EVS.clips.filter(Boolean).length), 'playlist', await ev(() => window.__dbg.EVS.playlist.length));
await page.locator('.lsm-key', { hasText: 'PLST PLAY' }).click();
await page.waitForTimeout(600);
log('pl playing', await ev(() => JSON.stringify(window.__dbg.EVS.ch[0].pl)));
await page.locator('.lsm-key', { hasText: 'DERN. ACTION' }).click();
const lv = await page.locator('#lsmlever').boundingBox();
await page.mouse.click(lv.x + lv.width / 2, lv.y + lv.height * 0.6);
await page.waitForTimeout(800);
log('evs ch0', await ev(() => { const c = window.__dbg.EVS.ch[0]; return JSON.stringify({ mode: c.mode, playing: c.playing, speed: c.speed, lever: c.lever }); }));
await page.locator('.lsm-trains').click({ position: { x: 400, y: 100 } });
await shot('v-evs');
// ---- chef de car : câblage ----
await ev(() => { window.__dbg.closeStation(); window.__dbg.openStation('chefdecar'); });
await page.waitForTimeout(800);
await page.locator('.tab', { hasText: 'Liste de câblage' }).click();
await page.waitForTimeout(500);
log('cable rows', await ev(() => document.querySelectorAll('.cabtbl tbody tr').length));
await shot('v-cables');
await page.locator('.cabtbl .linkbtn').nth(4).click();
await page.waitForTimeout(800);
await page.locator('#modal button', { hasText: 'Suivre' }).first().click();
await page.waitForTimeout(800);
log('modal title', await ev(() => document.querySelector('#modal h2')?.textContent));
await shot('v-follow');
await ev(() => document.querySelector('#modal .x').click());
// ---- tous les appareils ----
for (const k of ['cam', 'ccu', 'rcp', 'evs', 'lsm', 'router', 'mixer', 'mv', 'spg', 'da', 'rx', 'conv', 'pdc', 'icom', 'cns', 'tx1']) {
  await ev((k) => window.__dbg.openDevice(k, k === 'cam' || k === 'ccu' || k === 'rcp' ? 1 : 1), k);
  await page.waitForTimeout(250);
  const views = await ev(() => [...document.querySelectorAll('#modal .tabs .tab')].map((t) => t.textContent));
  const ports = await ev(() => document.querySelectorAll('#modal svg [data-id]').length);
  log('device', k, ports, 'éléments', views.join(' | '));
  for (let v = 0; v < views.length; v++) {
    await page.locator('#modal .tabs .tab').nth(v).click();
    await page.waitForTimeout(150);
    if (['rcp', 'lsm', 'cam', 'router'].includes(k)) await shot(`d-${k}-${v}`);
  }
}
// clic sur un port
await ev(() => window.__dbg.openDevice('ccu', 1, { view: 'arriere' }));
await page.waitForTimeout(300);
await page.locator('#modal svg [data-id="icom"]').first().click();
await page.waitForTimeout(300);
log('port info', await ev(() => document.querySelector('.eq-info h3')?.textContent));
await shot('d-ccu-port');
await ev(() => document.querySelector('#modal .x').click());
// chapitres du Cours
await ev(() => window.__dbg.openGuide('guide'));
await page.waitForTimeout(300);
log('guide chapters', await ev(() => document.querySelectorAll('#layer [data-g]').length));
await page.locator('#layer [data-g="evsarch"]').click();
await shot('g-evs');
await ev(() => document.querySelector('#layer .ly-close').click());
log('missions', await ev(() => Object.keys(window.__dbg.S.missionsDone).join(',')));
console.log('ERRORS:\n' + errors.slice(0, 30).join('\n'));
await browser.close();
process.exitCode = errors.length ? 1 : 0;
