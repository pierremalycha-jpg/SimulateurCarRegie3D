// Captures de référence pour le rendu : mêmes points de vue avant / après les changements graphiques
// node tools/gfx.mjs <dossier> [qualité] [lumière]
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/c77888a1-6f04-5876-a000-ab7e7f493575/scratchpad/gfx';
const Q = process.argv[3] || 'haute';
const L = process.argv[4] || 'jour';
const ONLY = process.argv[5] || '';
fs.mkdirSync(OUT, { recursive: true });
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const three = fs.readFileSync('node_modules/three/build/three.module.min.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' || /\[gfx\]/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + e.stack));
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: three, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
await page.route('http://local.test/**', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
await page.goto('http://local.test/?' + (process.env.Q || ''));
await page.waitForTimeout(2500);
const ev = (f, a) => page.evaluate(f, a);
const want = (n) => !ONLY || ONLY.split(',').includes(n);
const shot = async (n, wait = 2500) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }); console.log('shot', n); };
const t0 = Date.now();
if (want('g0')) await shot('g0-accueil', 3000);
await ev(({ Q, L }) => window.__dbg.start('standard', L, Q, false), { Q, L });
await page.waitForTimeout(5000);
// on cache l'interface pour juger l'image
await ev(() => { const s = document.createElement('style'); s.textContent = '#hud,#toolbar,#minimon,#status,#mission,#prompt,#intercom,#ses-chip,#commut-osd,.toast,#hint{visibility:hidden!important}'; document.head.appendChild(s); });
const tp = async (i, pitch, n, yawAdd = 0) => { await ev(({ i, pitch, yawAdd }) => { const D = window.__dbg; D.teleport(i); if (pitch != null) { D.PL.pitch = pitch; D.PL.cpitch = pitch; } D.PL.yaw += yawAdd; D.PL.cyaw = D.PL.yaw; }, { i, pitch, yawAdd }); await shot(n); };
if (want('g1')) await tp(5, -0.12, 'g1-bord-terrain');
if (want('g2')) await tp(10, -0.25, 'g2-kop');
if (want('g3')) await tp(13, null, 'g3-aerien');
if (want('g4')) await tp(0, 0.02, 'g4-compound');
if (want('g5')) await tp(1, -0.15, 'g5-car-prod');
if (want('g6')) await tp(8, -0.3, 'g6-passerelle');
// joueurs de près
if (want('g7')) {
  await ev(() => {
    const D = window.__dbg; const h = D.M.humans[9] || { x: 0, z: 0 };
    D.PL.fly = true; D.S.inTruck = false; D.PL.pos.set(h.x + 4, 0.2, h.z + 4); D.PL.y = 1.9; D.PL.yaw = Math.atan2(4, 4); D.PL.pitch = -0.12; D.PL.cyaw = D.PL.yaw; D.PL.cpitch = D.PL.pitch; 
  });
  await shot('g7-joueur');
  await ev(() => { window.__dbg.S.simPaused = false; });
}
// images des caméras broadcast (viseur cadreur)
const cam = async (id, lfK, n) => {
  await ev(({ id, lfK }) => { const D = window.__dbg; const c = D.S.cams.find((x) => x.id === id); if (!c) return; D.takeCamera(c); if (lfK != null) { const a = Math.log(c.fMin), b = Math.log(c.fMax); c.tgt.lf = a + (b - a) * lfK; c.lf.v = c.tgt.lf; } }, { id, lfK });
  await shot(n, 3500);
  await ev(() => window.__dbg.releaseCamera());
};
if (want('c1')) await cam(1, null, 'c1-cam1-large');
if (want('c2')) await cam(2, 0.55, 'c2-cam2-serre');
if (want('c3')) await cam(3, null, 'c3-cam3');
if (want('c4')) await cam(7, null, 'c4-cam7-epaule');
console.log('durée', ((Date.now() - t0) / 1000).toFixed(0), 's');
const fps = await ev(() => window.__dbg.S.fps || null);
console.log('fps', fps);
console.log('ERRORS', errors.length, errors.slice(0, 8).join('\n'));
await browser.close();
