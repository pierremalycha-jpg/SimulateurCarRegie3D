import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const three = fs.readFileSync('node_modules/three/build/three.module.min.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: three, contentType: 'application/javascript' }));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
await page.route('http://local.test/?lite', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
await page.goto('http://local.test/?lite');
await page.waitForFunction(() => window.__dbg, null, { timeout: 30000 });
await page.evaluate(() => window.__dbg.start('standard', 'jour', 'basse', false));
const W = (ms) => page.waitForTimeout(ms);
const ev = (f) => page.evaluate(f);
await W(3000);
const out = {};
// mélangeur : volet logo
out.sting = await ev(() => { const D = window.__dbg; D.MIX.trans = 'stinger'; D.MIX.rate = 10; const before = D.S.stats.stingers; document.dispatchEvent(new Event('x')); return before; });
await ev(() => { window.__dbg.MIX.auto = true; });
await W(15000);
out.pos = await ev(() => window.__dbg.MIX.pos);
out.stingAfter = await ev(() => [window.__dbg.S.stats.stingers, window.__dbg.MIX.pgm, window.__dbg.MIX.pst]);
// panne fibre
out.fault = await ev(() => { const D = window.__dbg; const c = D.S.cams[3]; c.fiberCut = true; c.checkLink(); return [c.id, c.status.ok, c.status.reason]; });
await W(1500);
// HF : steadicam dans le tunnel
out.rf0 = await ev(() => { const c = window.__dbg.S.cams.find((x) => x.rf); return [c.rf.state, Math.round(c.rf.margin)]; });
await ev(() => { const c = window.__dbg.S.cams.find((x) => x.rf); c.manual = true; c.manualMove = true; c.cam.position.set(0, 1.6, -80); });
await W(2500);
out.rfTunnel = await ev(() => { const c = window.__dbg.S.cams.find((x) => x.rf); return [c.rf.state, Math.round(c.rf.margin), Math.round(c.rf.snr)]; });
await ev(() => { window.__dbg.S.antennas.find((a) => a.id === 'ant_tun').on = true; });
await W(2500);
out.rfTunnelAnt = await ev(() => { const c = window.__dbg.S.cams.find((x) => x.rf); return [c.rf.state, Math.round(c.rf.margin)]; });
// exercice truquiste
await ev(() => { window.__dbg.openStation('realisateur'); });
await W(500);
await ev(() => { [...document.querySelectorAll('#station button')].find((b) => b.textContent.startsWith('Je suis truquiste')).click(); });
await W(25000);
out.exercise = await ev(() => document.querySelector('#intercom').innerText);
out.mode = await ev(() => window.__dbg.S.mode + ' ' + window.__dbg.S.station);
// EVS : état
out.evs = await ev(() => window.__dbg.EVS.ch.map((c) => [c.mode, c.cam, c.t.toFixed(1)]));
out.events = await ev(() => window.__dbg.S.events.length);
out.sim = await ev(() => window.__dbg.S.simTime.toFixed(1));
console.log(JSON.stringify(out, null, 1));
console.log('ERRORS', errors.join('\n'));
await browser.close();
