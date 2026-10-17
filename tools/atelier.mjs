// Atelier de montage : montage complet de la CAM 1 (visée réelle pour les premières pièces, puis opérations
// pilotées), refus pédagogiques, fibre sale à la mise en service, rapport, caméra rendue au dispositif.
// node tools/atelier.mjs <dossier>
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const OUT = process.argv[2] || '/tmp/claude-0/-home-user/c77888a1-6f04-5876-a000-ab7e7f493575/scratchpad/atelier';
fs.mkdirSync(OUT, { recursive: true });
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync('dist/index.html', 'utf8') + '</body></html>';
const three = fs.readFileSync('node_modules/three/build/three.module.min.js');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: three, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
await page.route('http://local.test/**', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
await page.goto('http://local.test/', { timeout: 180000 });
await page.waitForTimeout(2500);
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n, w = 1200) => { await page.waitForTimeout(w); await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }); console.log('shot', n); };
const fails = [];
const check = (ok, msg) => { console.log(ok ? 'OK  ' : 'FAIL', msg); if (!ok) fails.push(msg); };
const until = async (f, a, t = 60000) => {
  try { return await page.waitForFunction(f, a, { timeout: t, polling: 100 }); } catch (e) {
    console.log('TIMEOUT', String(f).slice(0, 120));
    console.log('ÉTAT', await page.evaluate(() => { const A = window.__dbg.AT; return JSON.stringify({ held: A.held, keyE: A.keyE, hold: A.hold && { t: A.hold.t, need: A.hold.need, label: A.hold.label }, target: A.target, done: [...A.done], modal: window.__dbg.S.modalOpen, mode: window.__dbg.S.mode, pos: window.__dbg.PL.pos, log: A.logEl && A.logEl.textContent }); }));
    await page.screenshot({ path: `${OUT}/zz-timeout.png`, timeout: 180000 });
    throw e;
  }
};

try { localStorage; } catch (e) { /* */ }
await ev(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } });
await ev(() => window.__dbg.start('atelier', 'jour', 'basse', false));
await until(() => window.__dbg.AT.active && document.querySelector('#atelier'));
check(await ev(() => !window.__dbg.S.cams.some((c) => c.id === 1)), 'la CAM 1 est démontée au début de l\'atelier');
check(await ev(() => window.__dbg.MIX.pgm === 2), 'l\'antenne reste sur la CAM 2');
check(await ev(() => Math.abs(window.__dbg.PL.pos.y - 17.225) < 0.01 && !window.__dbg.PL.fly), 'stagiaire posé sur la passerelle, à pied');
await page.waitForTimeout(1500);
check(await ev(() => Math.abs(window.__dbg.PL.pos.y - 17.225) < 0.05), 'pas de chute : le sol de la passerelle porte le stagiaire');

// visée : orienter le regard vers un point du monde
await ev(() => {
  window.__aim = (x, y, z) => { const D = window.__dbg, P = D.PL; const dx = x - P.pos.x, dy = y - P.y, dz = z - P.pos.z; P.yaw = P.cyaw = Math.atan2(-dx, -dz); P.pitch = P.cpitch = Math.atan2(dy, Math.hypot(dx, dz)); };
  window.__aimPart = (pid) => { const v = window.__dbg.AT.objs[pid].obj.getWorldPosition(new window.__dbg.pcam.position.constructor()); window.__aim(v.x, v.y + 0.05, v.z); };
  window.__aimRig = (x, y, z) => { const v = window.__dbg.AT.rig.localToWorld(new window.__dbg.pcam.position.constructor(x, y, z)); window.__aim(v.x, v.y, v.z); };
});
await shot('a01-passerelle', 1500);

// 1. prendre le pied (visée + E) : on s'approche du flight case
await ev(() => { const P = window.__dbg.PL; P.pos.set(-5.6, 17.225, -69.1); P.y = P.pos.y + 1.7; });
await ev(() => window.__aimPart('tripod'));
await until(() => { const t = window.__dbg.AT.target; return t && t.kind === 'pick' && t.part === 'tripod'; });
check(true, 'visée du pied dans son flight case');
check(await ev(() => !document.querySelector('#prompt').hidden && /Prendre/.test(document.querySelector('#prompt').textContent)), 'invite « Prendre : pied »');
await page.keyboard.press('KeyE');
check(await ev(() => window.__dbg.AT.held === 'tripod'), 'pied en main');
await ev(() => { const P = window.__dbg.PL; P.pos.set(-2.4, 17.225, -68.95); P.y = P.pos.y + 1.7; });
// 2. le poser sur le repère (fantôme)
await ev(() => window.__aimRig(0, 0.3, 0));
await until(() => { const t = window.__dbg.AT.target; return t && t.kind === 'mount' && t.part === 'tripod'; });
await shot('a02-fantome-pied', 600);
await page.keyboard.press('KeyE');
check(await ev(() => window.__dbg.AT.done.has('tripod') && !window.__dbg.AT.held), 'pied posé sur le repère');
// 3. jambes : geste maintenu
await ev(() => window.__aimRig(0.32, 0.45, 0.18));
await until(() => { const t = window.__dbg.AT.target; return t && t.kind === 'act' && t.op === 'legs'; });
await page.keyboard.down('KeyE');
await page.waitForTimeout(400);
check(await ev(() => !document.querySelector('#at-ring').hidden), 'anneau de maintien affiché');
await until(() => window.__dbg.AT.done.has('legs'), null, 90000);
await page.keyboard.up('KeyE');
check(true, 'jambes déployées en maintenant E');
await ev(() => window.__dbg.atelierDebug.fast(0.08)); // gestes maintenus raccourcis : le rendu logiciel tourne à ~1 image/s
// 4. erreur volontaire : la tête avant l'araignée
await ev(() => window.__dbg.atelierDebug.grab('head'));
await ev(() => window.__aimRig(0, 0.95 + 0.1, 0));
await until(() => { const t = window.__dbg.AT.target; return t && t.kind === 'mount' && t.part === 'head'; });
await shot('a03-fantome-refus', 600);
await page.keyboard.press('KeyE');
check(await ev(() => window.__dbg.AT.errors.length === 1 && /araignée/.test(window.__dbg.AT.errors[0].msg) && !window.__dbg.AT.done.has('head')), 'refus pédagogique : araignée non verrouillée (erreur comptée)');
check(await ev(() => document.querySelector('#at-err').textContent === '1'), 'compteur d\'erreurs du panneau');
await ev(() => document.querySelector('#atelier').classList.contains('flash')).then((v) => check(v, 'panneau signale l\'erreur'));
// reposer la tête (Q), verrouiller l'araignée, reprendre la tête
await page.keyboard.press('KeyQ');
check(await ev(() => !window.__dbg.AT.held && window.__dbg.AT.objs.head.state === 'case'), 'Q : pièce reposée dans son flight case');
await ev(() => window.__aimRig(0, 0.05, 0));
await until(() => { const t = window.__dbg.AT.target; return t && t.kind === 'act' && t.op === 'spreader'; });
await page.keyboard.press('KeyE');
check(await ev(() => window.__dbg.AT.done.has('spreader')), 'araignée verrouillée');

// la suite, pilotée
const D = (f, a) => ev(f, a);
const place = (pid, side) => D(([p, s]) => { const A = window.__dbg.atelierDebug; A.grab(p); A.install(p, s); }, [pid, side]);
const fin = (id) => D((i) => window.__dbg.atelierDebug.finishAct(i), id);
await place('head');
// mise à niveau : molette sur la bulle
await ev(() => window.__aimRig(-0.08, 0.95 + 0.21, 0.12));
await until(() => { const t = window.__dbg.AT.target; return t && t.kind === 'act' && t.op === 'level'; });
check(await ev(() => !document.querySelector('#at-gauge').hidden), 'jauge du niveau à bulle');
const lv0 = await ev(() => window.__dbg.AT.level);
await page.mouse.move(640, 400);
for (let i = 0; i < 30; i++) { const l = await ev(() => window.__dbg.AT.level); if (Math.abs(l) <= 0.2) break; await page.mouse.wheel(0, l > 0 ? -100 : 100); await page.waitForTimeout(60); }
await shot('a04-niveau', 500);
await page.keyboard.press('KeyE');
check(await ev(() => window.__dbg.AT.done.has('level')), `tête mise à niveau à la molette (départ ${lv0.toFixed(2)}°)`);
await fin('lock');
await place('barL'); await place('barR'); await place('plate'); await place('adaptor');
await fin('adlock'); await place('camera'); await fin('camlock');
// objectif : levage à deux (maintien)
await ev(() => window.__aimPart('lens'));
await until(() => { const t = window.__dbg.AT.target; return t && t.kind === 'pick' && t.part === 'lens'; });
await page.keyboard.down('KeyE');
await until(() => window.__dbg.AT.held === 'lens', null, 90000);
await page.keyboard.up('KeyE');
check(true, 'objectif soulevé à deux (maintien)');
await shot('a05-objectif-en-main', 400);
await D(() => window.__dbg.atelierDebug.install('lens'));
await fin('lenslock'); await fin('lenscable'); await place('vf');
await place('zoom', 'L'); await place('focus', 'R'); await fin('demcable');
await D(() => { window.__dbg.atelierDebug.setBalance(0); window.__dbg.atelierDebug.act('balance'); });
check(await ev(() => window.__dbg.AT.done.has('balance')), 'équilibrage');
// nettoyage de la prise murale seulement (on oublie la caméra) ; maintien avec le stylo
await D(() => window.__dbg.atelierDebug.grab('pen'));
await D(() => { window.__dbg.AT.keyE = true; window.__dbg.atelierDebug.act('cleanWall'); });
await until(() => window.__dbg.AT.done.has('cleanWall'), null, 90000);
await D(() => { window.__dbg.AT.keyE = false; });
await page.keyboard.press('KeyQ');
await place('fiber');
check(await ev(() => window.__dbg.AT.dirty.cam === true), 'fibre branchée sans nettoyer le côté caméra (sale)');
await fin('fiberWall'); await fin('strain'); await place('headset');
await shot('a06-camera-montee', 800);
// vue de trois quarts du montage
await ev(() => { const P = window.__dbg.PL; P.pos.set(-2.75, 17.225, -68.55); P.y = P.pos.y + 1.7; window.__aimRig(0, 1.25, 0); });
await shot('a07-montage-3-4', 1500);
await ev(() => { const P = window.__dbg.PL; P.pos.set(-1.5, 17.225, -69.15); P.y = P.pos.y + 1.7; });
// mise en service (bouchon oublié, fibre sale) : l'alarme de niveau optique tombe
await fin('power');
await until(() => window.__dbg.AT.cam && window.__dbg.S.cams.some((c) => c.id === 1), null, 30000);
check(await ev(() => window.__dbg.AT.cam.hideModel === true && window.__dbg.AT.cam.model.root.visible === false), 'CAM 1 allumée par la vision, modèle du simulateur masqué');
await until(() => window.__dbg.AT.errors.some((e) => e.op === 'clean'), null, 60000);
check(true, 'alarme CCU : niveau optique bas (fibre non nettoyée)');
check(await ev(() => [...document.querySelectorAll('#intercom .icm')].some((d) => /niveau optique bas/.test(d.textContent))), 'message de la vision à l\'intercom');
await shot('a08-alarme-fibre', 300);
// reprise : stylo, débrancher-nettoyer-rebrancher côté caméra
await D(() => window.__dbg.atelierDebug.grab('pen'));
await ev(() => window.__aimRig(0.04, 0.95 + 0.37, 0.46));
await until(() => { const t = window.__dbg.AT.target; return t && t.kind === 'act' && t.op === 'cleanCam'; });
await page.keyboard.down('KeyE');
await until(() => !window.__dbg.AT.dirty.cam, null, 90000);
await page.keyboard.up('KeyE');
check(true, 'connecteur caméra repris (maintien 1,8 s)');
await page.keyboard.press('KeyQ');
// tally avant le bouchon : refus
await D(() => window.__dbg.atelierDebug.act('tally'));
check(await ev(() => window.__dbg.AT.errors.some((e) => e.op === 'tally') && !window.__dbg.AT.done.has('tally')), 'tally refusé tant que le bouchon est sur l\'objectif');
await fin('cap');
check(await ev(() => !window.__dbg.AT.cap), 'bouchon retiré');
await page.waitForTimeout(1500);
check(await ev(() => { const c = window.__dbg.AT.cam; return c && c.lastRender > 0; }), 'la caméra montée produit une image');
// viseur, vu par le cadreur
await ev(() => { const P = window.__dbg.PL; P.pos.set(-1.5, 17.225, -68.55); P.y = P.pos.y + 1.62; window.__aimRig(0, 0.95 + 0.62, 0.137); });
await shot('a09-viseur', 2000);
await D(() => window.__dbg.atelierDebug.act('tally'));
await until(() => window.__dbg.AT.done.has('tally'), null, 30000);
await until(() => window.__dbg.AT.finished && !document.querySelector('#modal').hidden, null, 30000);
check(await ev(() => /Rapport de montage/.test(document.querySelector('#modal').textContent)), 'rapport de montage affiché');
const rep = await ev(() => window.__dbg.AT.report);
console.log('rapport', JSON.stringify({ grade: rep.grade, errs: rep.errs, sec: Math.round(rep.sec) }), rep.errors.map((e) => e.op));
await shot('a10-rapport', 600);
await ev(() => [...document.querySelectorAll('#modal .btn')].find((b) => /Laisser/.test(b.textContent)).click());
check(await ev(() => { const c = window.__dbg.S.cams.find((x) => x.id === 1); return !window.__dbg.AT.active && c && !c.hideModel && c.model.root.visible && !c.manual; }), 'caméra laissée en place : la CAM 1 reprend le dispositif');
check(await ev(() => !document.querySelector('#atelier') && !window.__dbg.W.scene.getObjectByName('atelier')), 'atelier retiré de la scène');
const n = await ev(() => window.__dbg.S.cams.length);
check(n === 12, `dispositif complet (${n} caméras)`);
// deuxième passage : quitter en cours de route rend la CAM 1 telle que prévue
await ev(() => window.__dbg.emit('startAtelier'));
await until(() => window.__dbg.AT.active);
check(await ev(() => !window.__dbg.S.cams.some((c) => c.id === 1)), 'nouvel atelier : CAM 1 démontée');
await ev(() => [...document.querySelectorAll('#atelier .btn')].find((b) => /Quitter/.test(b.textContent)).click());
check(await ev(() => !window.__dbg.AT.active && window.__dbg.S.cams.some((c) => c.id === 1) && window.__dbg.S.cams.length === 12), 'quitter : CAM 1 remise en place');

console.log('ERRORS', errors.length, errors.slice(0, 8).join('\n'));
console.log(fails.length ? `ÉCHECS ${fails.length}: ${fails.join(' | ')}` : 'TOUT VA BIEN');
await browser.close();
process.exit(fails.length || errors.length ? 1 : 0);
