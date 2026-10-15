// Tests du réseau ST 2110 spine-leaf : poste Réseau IP, CLI, pannes et effets à l'image
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/c77888a1-6f04-5876-a000-ab7e7f493575/scratchpad/net';
const FMT = process.argv[3] || 'HD';
fs.mkdirSync(OUT, { recursive: true });
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const three = fs.readFileSync('node_modules/three/build/three.module.min.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const errors = [];
const log = (...a) => console.log(...a);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + e.stack));
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: three, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
await page.route('http://local.test/**', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
await page.goto('http://local.test/?lite');
await page.waitForTimeout(2500);
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n, el) => { if (el) await page.locator(el).first().screenshot({ path: `${OUT}/${n}.png` }); else await page.screenshot({ path: `${OUT}/${n}.png` }); log('shot', n); };
await ev((f) => window.__dbg.start('standard', 'jour', 'basse', false, f, true), FMT);
await page.waitForTimeout(4500);
const st = () => ev(() => { const F = window.__dbg.FAB; const R = F.res; const rx = Object.values(R.rxState); return { sw: Object.keys(F.switches).length, dev: Object.keys(F.devices).length, rx: rx.length, lost: rx.filter((s) => !s.ok || s.loss > 0).length, unp: rx.filter((s) => s.ok && !s.protected).length, err: F.issues.filter((i) => i.sev === 'err').map((i) => i.title).slice(0, 4), warn: F.issues.filter((i) => i.sev === 'warn').length, gm: R.gmActive.red && R.gmActive.red.name, NET: window.__dbg.NET }; });
log('initial', JSON.stringify(await st()));
// poste réseau : tous les onglets
await ev(() => window.__dbg.openStation('reseau'));
await page.waitForTimeout(1200);
await shot('01-topo');
await shot('01b-topo-svg', '.net-svgwrap');
for (const [k, n] of [['switch', '02-switch'], ['addr', '03-addr'], ['flows', '04-flows'], ['ptp', '05-ptp'], ['diag', '06-diag']]) {
  await page.locator('#station .tabs .tab[data-k="' + k + '"]').click(); await page.waitForTimeout(700); await shot(n);
}
// commutateurs : sous-onglets
await page.locator('#station .tabs .tab[data-k="switch"]').click(); await page.waitForTimeout(400);
for (const sub of ['VLAN · SVI', 'Routage', 'Multicast', 'PTP', 'QoS', 'Configuration']) { await page.locator('#station .net-swmain .tabs .tab', { hasText: sub }).click(); await page.waitForTimeout(400); }
await shot('07-config');
// éditeur de port graphique : vitesse 10g sur la CCU 1 (rouge)
await page.locator('#station .net-swmain .tabs .tab', { hasText: 'Interfaces' }).click(); await page.waitForTimeout(300);
const speedSel = page.locator('#station .net-form .field', { hasText: 'Vitesse' }).locator('select');
await speedSel.selectOption('10g'); await page.waitForTimeout(800);
log('après speed 10g LEAF-R1 Et1', JSON.stringify(await ev(() => { const R = window.__dbg.FAB.res; return { nic: R.nic['ccu1:red'], me1: R.rxState.ME1 && { ok: R.rxState.ME1.ok, prot: R.rxState.ME1.protected } }; })));
log('explication', await ev(() => document.querySelector('.ex-item .ex-t')?.textContent.slice(0, 160)));
await speedSel.selectOption('25g'); await page.waitForTimeout(500);
// terminal
await page.locator('#station .net-swmain .tabs .tab', { hasText: 'Terminal' }).click(); await page.waitForTimeout(400);
const term = page.locator('#station .net-cmd');
for (const c of ['sh int st | inc connected', 'show ip ospf neighbor', 'conf t', 'int e2', 'shutdown', 'end', 'show interfaces Ethernet2 status', 'show ip mroute | inc 239.1.1', 'write memory']) { await term.fill(c); await term.press('Enter'); await page.waitForTimeout(150); }
await term.fill('sh ip ig'); await term.press('Tab'); log('tab completion', await term.inputValue());
await term.fill(''); await page.waitForTimeout(400);
await shot('08-terminal');
log('CCU2 rouge après shutdown', JSON.stringify(await ev(() => window.__dbg.FAB.res.nic['ccu2:red'])));
await ev(() => { const s = window.__dbg.FAB.switches['LEAF-R1']; s.running.ports.Ethernet2.shutdown = false; });
// pannes réseau : effets
const FAULTS = ['ipred', 'ipgm', 'ipnmos', 'ipmv', 'vlanccu', 'snoop', 'querier', 'ssm', 'mtu', 'rogue', 'fec', 'ptpdom', 'ipconf'];
for (const id of FAULTS) {
  await ev(() => window.__dbg.closeStation());
  await ev((id) => { window.__dbg.injectFault(id); window.__dbg.FAB.lastMap = ''; }, id);
  await page.waitForTimeout(id === 'querier' ? 600 : 1500);
  if (id === 'querier') { await ev(() => { for (const k of Object.keys(window.__dbg.FAB.timers)) window.__dbg.FAB.timers[k] = 60; window.__dbg.FAB.lastMap = ''; }); await page.waitForTimeout(1500); }
  const s = await st();
  const cams = await ev(() => window.__dbg.S.cams.filter((c) => !c.genlock).map((c) => c.id));
  log('panne', id, JSON.stringify({ lost: s.lost, unp: s.unp, err: s.err, gm: s.gm, unlock: cams, red: s.NET.redState, blue: s.NET.blueState, mvSat: s.NET.mvSat, nmos: s.NET.nmos }));
  if (['vlanccu', 'snoop', 'rogue', 'ipconf', 'ipmv'].includes(id)) { await ev(() => window.__dbg.openStation('reseau')); await page.waitForTimeout(800); await page.locator('#station .tabs .tab[data-k="diag"]').click(); await page.waitForTimeout(500); await shot('20-panne-' + id); await ev(() => window.__dbg.closeStation()); }
  if (id === 'vlanccu' || id === 'ipmv' || id === 'ssm') { await ev(() => window.__dbg.openStation('realisateur')); await page.waitForTimeout(1500); await shot('21-mv-' + id); await ev(() => window.__dbg.closeStation()); }
  // réparation : tout réparer
  await ev(() => window.__dbg.clearFaults());
  await page.waitForTimeout(300);
}
// réparation par la ligne de commande : mauvais domaine PTP
await ev(() => window.__dbg.injectFault('ptpdom'));
await page.waitForTimeout(1200);
log('ptpdom avant', JSON.stringify((await st()).err));
await ev(() => window.__dbg.openStation('reseau', 'LEAF-R1'));
await page.waitForTimeout(800);
await page.locator('#station .net-swmain .tabs .tab', { hasText: 'Terminal' }).click(); await page.waitForTimeout(300);
for (const c of ['conf t', 'ptp domain 127', 'end', 'wr']) { await term.fill(c); await term.press('Enter'); await page.waitForTimeout(120); }
await ev(() => { window.__dbg.FAB.switches['LEAF-B1'].running.ptp.domain = 127; window.__dbg.FAB.lastMap = ''; });
await page.waitForTimeout(1500);
log('ptpdom après CLI', JSON.stringify((await st()).err), 'résolues', await ev(() => window.__dbg.ACTIVE.filter((a) => a.done).length + '/' + window.__dbg.ACTIVE.length));
// mode SDN avec multiviewer à 25G
await ev((f) => { window.__dbg.FAB.mode = 'sdn'; for (const s of ['LEAF-R4', 'LEAF-B4']) window.__dbg.FAB.switches[s].running.ports.Ethernet53.speed = f === 'UHD' ? '25g' : '10g'; window.__dbg.FAB.lastMap = ''; }, FMT);
await ev(() => window.__dbg.closeStation());
await page.waitForTimeout(1500);
log('SDN 25G', JSON.stringify(await st()));
await ev(() => window.__dbg.openStation('realisateur')); await page.waitForTimeout(1500); await shot('22-mv-sdn');
await ev(() => window.__dbg.closeStation());
// synoptiques IP
await ev(() => window.__dbg.emit('openSynoptics', 'net')); await page.waitForTimeout(1200); await shot('30-syn-net');
log('errors', errors.length, JSON.stringify(errors.slice(0, 6)));
await browser.close();
