// Tests du parcours de formation réseau et des outils de mesure (poste Réseau IP)
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/c77888a1-6f04-5876-a000-ab7e7f493575/scratchpad/course';
const FMT = process.argv[3] || 'HD';
const FULL = process.argv[4] === 'full';
fs.mkdirSync(OUT, { recursive: true });
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const three = fs.readFileSync('node_modules/three/build/three.module.min.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const errors = []; const log = (...a) => console.log(...a);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + e.stack));
page.on('dialog', (d) => d.accept());
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: three, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
await page.route('http://local.test/**', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
await page.goto('http://local.test/?lite'); await page.waitForTimeout(2500);
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); log('shot', n); };
const tab = async (k) => { await page.locator(`#station .tabs .tab[data-k="${k}"]`).first().click(); await page.waitForTimeout(500); };
const term = async (cmds) => { const t = page.locator('#station .net-cmd'); for (const c of cmds) { await t.fill(c); await t.press('Enter'); await page.waitForTimeout(150); } };
const objs = () => ev(() => [...document.querySelectorAll('#station .net-mission .net-obj li')].map((l) => (l.classList.contains('ok') ? '✓' : '○') + l.textContent.slice(1, 50)));
await ev((f) => window.__dbg.start('standard', 'jour', 'basse', false, f, true), FMT);
await page.waitForTimeout(4000);
await ev(() => window.__dbg.openStation('reseau')); await page.waitForTimeout(1000);
await tab('learn'); await shot('01-formation');
// ---- mission 1 ----
await page.locator('#station .net-mcard').first().locator('button').click(); await page.waitForTimeout(600);
log('NC.active', await ev(() => window.__dbg.NC.active));
const svgClick = async (sel) => { await page.locator(sel).first().click({ force: true }); await page.waitForTimeout(350); };
await svgClick('#station .net-topo .nt-box.sw.red'); // spine
await ev(() => { const S = window.__dbg; S.emit('netlog', { type: 'sel', kind: 'sw', id: 'LEAF-R1', role: 'leaf' }); S.emit('netlog', { type: 'sel', kind: 'link', id: 'x' }); S.emit('netlog', { type: 'sel', kind: 'dev', id: 'ccu1' }); });
await page.waitForTimeout(400);
log('objectifs n1', JSON.stringify(await objs()));
await tab('learn');
await page.locator('#station .net-q input').first().fill('4'); await page.locator('#station .net-q button').first().click(); await page.waitForTimeout(800);
log('n1 fait', await ev(() => JSON.stringify(window.__dbg.NC.done)));
await shot('02-mission-reussie');
// ---- mission 3 (CLI) ----
await ev(() => { window.__dbg.NC.done = null; });
await tab('learn');
await page.locator('#station .net-mcard').nth(2).locator('button').click(); await page.waitForTimeout(800);
await term(['sh int st', 'sh lldp nei', 'sh run | section Vlan']);
log('objectifs n3', JSON.stringify(await objs()));
await tab('learn');
const port2 = await ev(() => Object.values(window.__dbg.FAB.devices).filter((d) => d.kind === 'ccu')[1].nics.red.port);
await page.locator('#station .net-q input').first().fill(port2.replace('Ethernet', 'Et')); await page.locator('#station .net-q button').first().click(); await page.waitForTimeout(800);
log('n3 fait', await ev(() => JSON.stringify(window.__dbg.NC.done)));
// ---- mesures ----
await tab('meas'); await page.waitForTimeout(1500); await shot('10-analyseur');
for (const [k, n] of [['Suivi PTP', '11-ptp'], ['Charge des liens', '13-charge']]) { await page.locator('#station .net .tabs .tab', { hasText: k }).click(); await page.waitForTimeout(1500); await shot(n); }
await page.locator('#station .net .tabs .tab', { hasText: 'Capture' }).click(); await page.waitForTimeout(600);
await page.locator('#station button', { hasText: 'Créer la session miroir' }).click(); await page.waitForTimeout(800);
const pk = page.locator('#station .net-pk tbody tr'); log('paquets capturés', await pk.count());
await pk.nth(1).click(); await page.waitForTimeout(400);
await shot('12-capture');
log('decode', await ev(() => [...document.querySelectorAll('#station .net-decode summary')].map((s) => s.textContent).join(' / ')));
// ---- SDP commenté ----
await tab('addr'); await page.locator('#station .net-tbl button', { hasText: /^SDP$/ }).first().click(); await page.waitForTimeout(600); await shot('14-sdp');
await ev(() => document.querySelector('#modal .x') && document.querySelector('#modal .x').click());
// ---- dépannage n9 ----
await tab('learn');
await page.locator('#station .net-mcard').nth(8).locator('button').click(); await page.waitForTimeout(1500);
const dev = await ev(() => { const e = window.__dbg.NC.entry; return e && e.st.dev; });
log('panne n9 sur', dev, JSON.stringify(await objs()));
const nic = await ev((d) => window.__dbg.FAB.devices[d].nics, dev);
for (const c of ['red', 'blue']) {
  await ev((sw) => window.__dbg.openStation('reseau', sw), nic[c].sw); await page.waitForTimeout(600);
  await page.locator('#station .net-swmain .tabs .tab', { hasText: 'Terminal' }).click(); await page.waitForTimeout(300);
  await term(['conf t', `int ${nic[c].port}`, `switchport access vlan ${c === 'red' ? 101 : 201}`, 'end', 'wr']);
}
await page.waitForFunction(() => window.__dbg.NC.done, null, { timeout: 30000 }).catch(() => {});
log('n9 fait', await ev(() => JSON.stringify(window.__dbg.NC.done)), JSON.stringify(await objs()));
// ---- quiz ----
await ev(() => window.__dbg.NC.done = null);
await tab('learn'); await page.locator('#station button', { hasText: 'Quiz ST 2110' }).click(); await page.waitForTimeout(500);
for (let i = 0; i < 10; i++) { await page.locator('#modal .net-opt').first().click(); await page.waitForTimeout(150); await page.locator('#modal .btn.primary').last().click(); await page.waitForTimeout(150); }
await shot('20-quiz'); log('quiz', await ev(() => document.querySelector('#modal .lcd')?.textContent));
await ev(() => document.querySelector('#modal .x') && document.querySelector('#modal .x').click());
// ---- examen ----
await tab('learn'); await page.locator('#station button', { hasText: 'Examen réseau' }).click(); await page.waitForFunction(() => window.__dbg.NC.exam && window.__dbg.NC.exam.faults.length > 0, null, { timeout: 40000 }).catch(() => {}); await page.waitForTimeout(800);
log('examen', await ev(() => JSON.stringify({ ids: window.__dbg.NC.exam.ids, faults: window.__dbg.NC.exam.faults.length })));
await shot('21-examen');
await page.locator('#station button', { hasText: 'Terminer l\'examen' }).click(); await page.waitForTimeout(800);
await shot('22-examen-fin'); log('score examen', await ev(() => window.__dbg.NC.exam && window.__dbg.NC.exam.score));
await page.waitForTimeout(3000);
log('progression', await ev(() => { const p = JSON.parse(localStorage.getItem('carregie.progress') || 'null') || {}; const n = p.net || {}; return JSON.stringify({ missions: Object.keys(n.missions || {}), quiz: (n.quiz || []).length, exams: (n.exams || []).length }); }));
if (FULL) { await ev(() => { window.__dbg.closeStation(); window.__dbg.openTrainer && window.__dbg.openTrainer('eleves'); }); await page.waitForTimeout(1200); await shot('30-suivi'); }
log('errors', errors.length, JSON.stringify(errors.slice(0, 6)));
await browser.close();
