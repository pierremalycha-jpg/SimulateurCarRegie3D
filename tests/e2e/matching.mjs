// Le matching à la mire (v19.30) : la page servie par tools/matching.mjs, la démonstration (deux caméras
// simulées, le raccord en trois tours avec les échelles apprises), le pointage des coins à la main, une
// fausse caméra Panasonic (instantané par le relais, lecture des réglages, commandes reçues), les refus du
// relais, la largeur téléphone.
// node tests/e2e/matching.mjs [dossier]
import { launch, outDir, until, reporter } from './harness.mjs';
import { imageMire } from '../helpers/png.mjs';
import { simulerCamera } from '../../src/matching/calc.js';
import { MIRES } from '../../src/matching/mires.js';
import { codeTemperature } from '../../src/matching/panasonic.js';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

const OUT = outDir('matching');
const R = reporter();
const ROOT = path.resolve(import.meta.dirname, '../..');
const MIRE = MIRES.colorchecker;

// ---- la fausse caméra Panasonic : aw_cam (état par registre, écho), instantané PNG, journal ----
const RECT = { x: 120, y: 60, w: 720, h: 420 }; // la zone des pastilles dans l'instantané (960 × 540)
const CAM_B = simulerCamera(MIRE, { noir: [0.01, 0.01, 0.015], gain: [0.93, 0.95, 1.03], gamma: 0.43, matrice: { rg: -0.08, rb: 0.02, gr: 0.04, gb: 0, br: -0.03, bg: 0.05 } });
const PNG = imageMire(960, 540, CAM_B, MIRE, RECT);
const etat = { ORI: '096', OBI: '096', OTP: '096', ORP: '096', OBP: '096', 'OSA:6A': '76', 'OSD:B0': '80', 'OSD:B1': codeTemperature(5600).toString(16).toUpperCase().padStart(3, '0'), 'OSE:31': '0', OAW: '1' };
for (const c of ['A4', 'A5', 'A6', 'A7', 'A8', 'A9']) etat['OSD:' + c] = '80';
const recues = [];
const fausse = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/cgi-bin/aw_cam') {
    const cmd = u.searchParams.get('cmd') || ''; recues.push(cmd);
    let m;
    if ((m = /^Q(SD:[0-9A-F]{2}|SA:[0-9A-F]{2}|SE:[0-9A-F]{2}|[A-Z]{2})$/.exec(cmd))) { const k = 'O' + m[1]; res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(k in etat ? `${k}:${etat[k]}` : 'ER1'); }
    if ((m = /^(O[A-Z]{2}|OS[ADE]:[0-9A-F]{2}):([0-9A-F]+)$/.exec(cmd))) { etat[m[1]] = m[2]; res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(cmd); }
    if (cmd === 'OWS') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('OWS'); }
    res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ER1');
  }
  if (u.pathname === '/cgi-bin/camera') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  res.writeHead(404); res.end();
});
await new Promise((r) => fausse.listen(0, '127.0.0.1', r));
const PORT_CAM = /** @type {any} */ (fausse.address()).port;

// ---- le serveur de la page ----
const PORT = 8100 + Math.floor(Math.random() * 800);
const srv = spawn(process.execPath, ['tools/matching.mjs', '--port', String(PORT)], { cwd: ROOT });
let srvLog = '';
srv.stdout.on('data', (d) => { srvLog += d; }); srv.stderr.on('data', (d) => { srvLog += d; });
process.on('exit', () => { try { srv.kill(); } catch (e) { /* déjà arrêté */ } fausse.close(); });
for (let i = 0; i < 100 && !srvLog.includes('http://localhost'); i++) await new Promise((r) => setTimeout(r, 100));
R.check('serveur du matching démarré', srvLog.includes(`http://localhost:${PORT}`), srvLog.slice(0, 200));

const b = await launch();
const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(180000);
page.on('pageerror', (e) => R.errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/net::|favicon|status of 40[03]/.test(m.text())) R.errors.push(m.text()); }); // les 400 et 403 du relais sont voulus
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction('!!window.__dbgMatching');
R.check('la page : titre, deux cartes, quatre étapes, scopes', await page.evaluate(() => document.title.startsWith('Matching à la mire') && document.querySelectorAll('.carte').length === 2 && document.querySelectorAll('.etapes li').length === 4 && !!document.querySelector('#parade') && !!document.querySelector('#vecto')));
R.check('mentions : TIEE Simulator, BTS de Saint-Quentin', await page.evaluate(() => /TIEE Simulator/.test(document.body.textContent) && /Saint-Quentin/.test(document.body.textContent)));
R.check('relais présent (page servie par tools/matching.mjs)', await page.evaluate(() => window.__dbgMatching.relaisPresent()));
await page.screenshot({ path: OUT + '/m1-page.png', fullPage: true });

// ---- la démonstration : deux caméras simulées, le diagnostic ----
await page.locator('.carte.a [data-source=demo]').click();
await page.locator('.carte.b [data-source=demo]').click();
R.check('démonstration : deux mesures, un diagnostic', await until(page, () => { const S = window.__dbgMatching.S; return !!S.cams.A.mesure && !!S.cams.B.mesure && !!S.diag; }, null, 20000));
const d1 = await page.evaluate(() => { const d = window.__dbgMatching.S.diag; return { avant: d.ecart.avant.moyen, apres: d.ecart.apres.moyen, ok: d.ok, gB: d.gamma.gB, dbR: d.balance.dbR, dbB: d.balance.dbB, master: d.noirs.master, rg: d.matrice.rg, diaph: d.exposition.diaph }; });
R.check('écart visible avant, raccord prévu après', d1.avant > 3 && d1.apres < 1.5 && d1.ok, JSON.stringify(d1));
R.check('défauts retrouvés : gamma 0,42, rouge en moins, bleu en trop, noir relevé, R-G, sous-exposée', Math.abs(d1.gB - 0.42) < 0.01 && d1.dbR > 0.2 && d1.dbB < -0.2 && d1.master < -0.4 && d1.rg > 0.04 && d1.diaph > 0.05, JSON.stringify(d1));
R.check('le raccord affiche les six blocs, « À régler », des consignes en pas et des boutons Appliquer', await page.evaluate(() => document.querySelectorAll('#raccord .reglage').length === 6 && /À régler/.test(document.querySelector('#raccord .score').textContent) && document.querySelectorAll('#raccord .reglage.a-faire').length >= 4 && document.querySelectorAll('#raccord .reglage .val').length >= 8 && document.querySelectorAll('#raccord .cote .btn').length >= 5));
R.check('les étapes : trois faites, le raccord en cours', await page.evaluate(() => document.querySelectorAll('.etapes li.fait').length === 3 && document.querySelector('.etapes li:nth-child(4)').className === 'en-cours'));
R.check('journal : un premier tour', await page.evaluate(() => window.__dbgMatching.S.tours.length === 1 && document.querySelectorAll('#journal tbody tr').length === 1));
await page.screenshot({ path: OUT + '/m2-demo-diagnostic.png', fullPage: true });

// ---- tour 2 : appliquer les consignes sur la caméra simulée (échelles cachées), remesurer, apprendre ----
async function appliquerTout() {
  for (const sel of ['#raccord .reglage:nth-child(1) .cote .btn', '#raccord .reglage:nth-child(2) .cote .btn:not(:last-child)', '#raccord .reglage:nth-child(3) .cote .btn', '#raccord .reglage:nth-child(4) .cote .btn', '#raccord .reglage:nth-child(5) .cote .btn']) {
    for (const btn of await page.locator(sel).all()) { if (await btn.isEnabled()) { await btn.click(); await page.waitForTimeout(50); } }
  }
  const n = await page.evaluate(() => window.__dbgMatching.S.tours.length);
  await page.locator('#raccord .actions .btn.prim').click();
  return until(page, (n0) => window.__dbgMatching.S.tours.length > n0, n, 20000);
}
R.check('tour 2 : appliqué et remesuré', await appliquerTout());
const t2 = await page.evaluate(() => { const S = window.__dbgMatching.S; return { tours: S.tours.map((t) => [t.avant, t.apres, t.applique.join(' · ')]), echelles: S.echelles, d: S.diag.ecart.avant.moyen }; });
R.check('tour 2 : l\'écart mesuré a nettement baissé', t2.tours[1][0] < t2.tours[0][0] / 2, JSON.stringify(t2.tours.map((t) => t[0].toFixed(2))));
R.check('tour 2 : le journal dit ce qui a été appliqué et les échelles apprises', /GAIN|PEDESTAL|MATRIX|GAMMA/.test(t2.tours[1][2]) && /échelles apprises/.test(t2.tours[1][2]), t2.tours[1][2].slice(0, 200));
R.check('les échelles apprises approchent celles de la caméra simulée (matrice 80 pas par coefficient ; les gains, trop petits, ne s\'apprennent pas encore)', Math.abs(Math.abs(t2.echelles['he130.matrice.rg'] || 0) - 80) < 20 && Math.abs(Math.abs(t2.echelles['he130.matrice.bg'] || 0) - 80) < 20, JSON.stringify(t2.echelles));
R.check('tour 3 : appliqué et remesuré', await appliquerTout());
const t3 = await page.evaluate(() => { const S = window.__dbgMatching.S; return { avant: S.diag.ecart.avant.moyen, max: S.diag.ecart.avant.max, score: document.querySelector('#raccord .score').textContent, tours: S.tours.length }; });
R.check('tour 3 : les caméras sont raccordées (ΔE sous 2, le score le dit)', t3.avant < 2 && /Raccordées/.test(t3.score), JSON.stringify(t3));
await page.screenshot({ path: OUT + '/m3-raccordees.png', fullPage: true });

// ---- les coins à la main : effacer puis cliquer les quatre coins de la mire de B ----
await page.locator('.carte.b .actions .btn', { hasText: 'Effacer les coins' }).click();
R.check('coins effacés : plus de mesure B ni de diagnostic', await page.evaluate(() => { const S = window.__dbgMatching.S; return S.cams.B.coins.length === 0 && !S.cams.B.mesure && !S.diag; }));
const coins = await page.evaluate(() => { const c = window.__dbgMatching.S.cams.B; const r = c.el.canvas.getBoundingClientRect(); return c.coinsDemo.map((p) => ({ x: r.left + p.x * r.width / c.image.width, y: r.top + p.y * r.height / c.image.height })); });
for (const p of coins) await page.mouse.click(p.x, p.y);
R.check('quatre clics : la mire est placée et mesurée, le diagnostic revient', await until(page, () => { const S = window.__dbgMatching.S; return S.cams.B.coins.length === 4 && !!S.cams.B.mesure && !!S.diag; }, null, 10000));
R.check('la mesure à la main donne le même écart que les coins de la démonstration', Math.abs(await page.evaluate(() => window.__dbgMatching.S.diag.ecart.avant.moyen) - t3.avant) < 0.4);

// ---- la fausse Panasonic : instantané par le relais, lecture des réglages, commandes ----
await page.locator('.carte.b select').first().selectOption('he130');
await page.locator('.carte.b input[type=text]').fill(`127.0.0.1:${PORT_CAM}`);
await page.locator('.carte.b [data-source=ip]').click();
R.check('instantané reçu par le relais (960 × 540)', await until(page, () => { const c = window.__dbgMatching.S.cams.B; return !!c.image && c.image.width === 960 && c.source === 'ip'; }, null, 20000));
const coinsIp = await page.evaluate((rect) => { const c = window.__dbgMatching.S.cams.B; const r = c.el.canvas.getBoundingClientRect(); const f = (x, y) => ({ x: r.left + x * r.width / c.image.width, y: r.top + y * r.height / c.image.height }); return [f(rect.x, rect.y), f(rect.x + rect.w, rect.y), f(rect.x + rect.w, rect.y + rect.h), f(rect.x, rect.y + rect.h)]; }, RECT);
for (const p of coinsIp) await page.mouse.click(p.x, p.y);
R.check('mire pointée sur l\'instantané : mesure et diagnostic', await until(page, () => { const S = window.__dbgMatching.S; return S.cams.B.coins.length === 4 && !!S.cams.B.mesure && !!S.diag; }, null, 10000));
const dIp = await page.evaluate(() => { const d = window.__dbgMatching.S.diag; return { gB: d.gamma.gB, dbR: d.balance.dbR, apres: d.ecart.apres.moyen }; });
R.check('la caméra de l\'instantané est lue (gamma 0,43, rouge en moins)', Math.abs(dIp.gB - 0.43) < 0.02 && dIp.dbR > 0.1 && dIp.apres < 1.5, JSON.stringify(dIp));
await page.locator('.carte.b [data-lire]').click();
R.check('lecture des réglages : gain R 0, gamma 0,45, matrice R-G 0, 5600 K', await until(page, () => { const c = window.__dbgMatching.S.cams.B.courant; return c.gainR === 0 && Math.abs(c.gamma - 0.45) < 1e-9 && c['matrice.rg'] === 0 && c.temperature === 5600; }, null, 20000));
R.check('la page dit « en cours » dans les consignes', await page.evaluate(() => /en cours/.test(document.querySelector('#raccord').textContent)));
const avantCmd = recues.length;
await page.locator('#raccord .reglage:nth-child(2) .cote .btn').first().click();
R.check('Appliquer le gain R : la caméra reçoit ORI', await until(page, () => /Fait/.test(document.querySelector('#raccord .reglage:nth-child(2) .cote .btn').textContent), null, 20000) && recues.slice(avantCmd).some((c) => /^ORI:[0-9A-F]{3}$/.test(c)), recues.slice(avantCmd).join(' '));
await page.locator('#raccord .reglage:nth-child(5) .cote .btn').first().click();
R.check('Appliquer la matrice : type User puis six coefficients', await until(page, () => /Fait/.test(document.querySelector('#raccord .reglage:nth-child(5) .cote .btn').textContent), null, 20000) && recues.includes('OSE:31:3') && ['A4', 'A5', 'A6', 'A7', 'A8', 'A9'].every((c) => recues.some((r) => r.startsWith('OSD:' + c + ':'))), recues.slice(-8).join(' '));
R.check('le gain R envoyé n\'est pas nul et tient dans ±150', (() => { const c = recues.find((r) => /^ORI:/.test(r)); const v = parseInt(c.slice(4), 16) - 0x96; return v !== 0 && Math.abs(v) <= 150; })());
await page.screenshot({ path: OUT + '/m4-camera-ip.png', fullPage: true });

// ---- le relais ne sort pas du réseau privé ni de /cgi-bin/ ----
const codes = await page.evaluate(async (pc) => {
  const f = async (u) => (await fetch(u)).status;
  return [await f('/relais'), await f('/relais?url=http://8.8.8.8/cgi-bin/aw_cam?cmd=QRI'), await f(`/relais?url=http://127.0.0.1:${pc}/autre`), await f(`/relais?url=https://127.0.0.1:${pc}/cgi-bin/x`), await f(`/relais?url=http://127.0.0.1:${pc}/cgi-bin/aw_cam?cmd=QRI%26res=1`)];
}, PORT_CAM);
R.check('relais : 400 sans url, 403 hors réseau privé, hors /cgi-bin/ et en https, 200 vers la caméra', codes.join(',') === '400,403,403,403,200', codes.join(','));

// ---- la page ouverte d'un double-clic (file://), sans serveur : démonstration, valeurs en cours à la main, commandes directes ----
const F = await b.newPage({ viewport: { width: 1280, height: 900 } });
F.setDefaultTimeout(180000);
F.on('pageerror', (e) => R.errors.push('FILE PAGEERROR: ' + e.message));
F.on('console', (m) => { if (m.type() === 'error' && !/net::|favicon|status of 40[03]|Failed to fetch/.test(m.text())) R.errors.push('file: ' + m.text()); });
await F.goto('file://' + path.join(ROOT, 'dist', 'matching.html'));
await F.waitForFunction('!!window.__dbgMatching');
R.check('file:// : la page s\'ouvre, sans relais', await F.evaluate(async () => !!document.querySelector('.carte.a') && !(await window.__dbgMatching.relaisPresent())));
R.check('file:// : la référence propose d\'abord l\'image de la FB80, la PTZ la carte d\'acquisition', await F.evaluate(() => /Image de la FB80/.test(document.querySelector('.carte.a .sources .btn').textContent) && /Carte d'acquisition/.test(document.querySelector('.carte.b .sources .btn').textContent) && /FB80/.test(document.querySelector('.carte.a h3').textContent) && /PTZ/.test(document.querySelector('.carte.b h3').textContent)));
await F.locator('.carte.a [data-source=demo]').click();
await F.locator('.carte.b [data-source=demo]').click();
R.check('file:// : la démonstration donne un diagnostic', await until(F, () => !!window.__dbgMatching.S.diag, null, 20000));
await F.locator('.carte.b [data-source=ip]').click();
R.check('file:// : l\'instantané IP explique qu\'il faut la carte d\'acquisition ou un fichier', await until(F, () => /carte d'acquisition/.test(document.querySelector('.carte.b .message').textContent), null, 5000));
await F.locator('.carte.b [data-lire]').click();
R.check('file:// : « Lire la caméra » renvoie aux valeurs en cours à entrer, dépliées', await until(F, () => document.querySelector('.carte.b .courant').open && /valeurs en cours/.test(document.querySelector('.carte.b .message').textContent), null, 5000));
R.check('file:// : douze champs de valeurs en cours pour la Panasonic, aucun pour la Sony', await F.evaluate(() => document.querySelectorAll('.carte.b [data-courant]').length === 12 && document.querySelector('.carte.a .courant').hidden));
await F.evaluate(() => { document.querySelector('.carte.b .courant').open = true; });
await F.locator('.carte.b [data-courant=gainR]').fill('12');
R.check('file:// : une valeur entrée se retrouve dans la consigne (« en cours +12 »)', await until(F, () => window.__dbgMatching.S.cams.B.courant.gainR === 12 && /en cours \+12/.test(document.querySelector('#raccord').textContent), null, 5000));
// la démonstration mise de côté : une vraie adresse, la commande part directement (no-cors) à la fausse caméra
await F.evaluate(() => { window.__dbgMatching.S.cams.B.source = 'fichier'; });
await F.locator('.carte.b input[type=text]').fill(`127.0.0.1:${PORT_CAM}`);
const avantDirect = recues.length;
await F.locator('#raccord .reglage:nth-child(2) .cote .btn').first().click();
R.check('file:// : Appliquer envoie ORI directement à la caméra, depuis +12 en cours', await until(F, () => /Fait/.test(document.querySelector('#raccord .reglage:nth-child(2) .cote .btn').textContent), null, 20000) && recues.slice(avantDirect).some((c) => /^ORI:/.test(c) && parseInt(c.slice(4), 16) - 0x96 > 12), recues.slice(avantDirect).join(' '));
const avantPrep = recues.length;
await F.locator('.carte.b [data-preparer]').click();
R.check('file:// : Préparer la Panasonic envoie AWB A et matrice User', await until(F, (n) => window.__dbgMatching.S.cams.B.message.includes('préparée'), null, 20000) && recues.slice(avantPrep).join(' ') === 'OAW:1 OSE:31:3', recues.slice(avantPrep).join(' '));
await F.locator('#raccord [data-copier]').click();
R.check('file:// : « Copier les consignes » (texte prêt, bouton « Copié » ou alerte)', await until(F, () => /Copié/.test(document.querySelector('#raccord [data-copier]').textContent) || !document.querySelector('#alerte').hidden, null, 5000));
await F.screenshot({ path: OUT + '/m6-file.png', fullPage: true });

// ---- téléphone ----
await page.setViewportSize({ width: 390, height: 780 });
await page.waitForTimeout(300);
R.check('téléphone : pas de défilement horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
await page.screenshot({ path: OUT + '/m5-telephone.png', fullPage: true });

srv.kill(); fausse.close();
await R.finish();
