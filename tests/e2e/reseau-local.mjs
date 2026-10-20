// Réseau local : vrai serveur (lan/serveur.mjs) + trois navigateurs.
// Alice héberge (réalisatrice), Bruno rejoint (truquiste), Chloé rejoint (cadreuse CAM 3).
// Pseudos, avatars et étiquettes, position suivie, assis au poste, rôle attribué par l'hôte,
// ordres, match suivi, cadreur, carte du car, compte rendu écrit sur l'ordinateur de l'hôte.
// node tests/e2e/reseau-local.mjs [dossier]
import { launch, openPage, outDir, until, closeAll } from './harness.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
const OUT = outDir('reseau-local');
const PORT = 8000 + Math.floor(Math.random() * 900);
// le serveur tourne dans un dossier de travail à part (il y écrit ses comptes rendus)
const WORK = path.join(OUT, 'srv'); fs.rmSync(WORK, { recursive: true, force: true }); fs.mkdirSync(WORK, { recursive: true });
const srv = spawn(process.execPath, [path.resolve('dist/car-regie-serveur-lan.mjs'), '--port', String(PORT)], { cwd: WORK });
let srvLog = '';
const servers = [srv];
process.on('exit', () => { for (const x of servers) { try { x.kill(); } catch (e) { /* déjà arrêté */ } } });
srv.stdout.on('data', (d) => { srvLog += d; }); srv.stderr.on('data', (d) => { srvLog += d; });
for (let i = 0; i < 50 && !srvLog.includes('localhost'); i++) await new Promise((r) => setTimeout(r, 100));
console.log(srvLog.split('\n').filter((l) => /http:/.test(l)).join('\n'));

// un navigateur par joueur, comme dans la vraie salle (dans un même navigateur, le rendu logiciel des
// pages déjà ouvertes affame le chargement des suivantes)
const errors = []; let fails = 0;
const log = (...a) => console.log(...a);
const check = (n, ok, x = '') => { if (!ok) fails++; log(ok ? 'OK  ' : 'FAIL', n, x); };
const newPage = async (id, q = 'lite') => openPage(await launch(), {
  id, errors, url: `http://localhost:${PORT}/?${q}`, ready: '!!window.__dbg && !!document.querySelector("#start .callsheet")',
  before: (page) => page.addInitScript(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } }),
});

// ---- Alice héberge ----
const A = await newPage('alice');
check('page servie par le serveur réseau local (three.js intégré)', await A.evaluate(() => !!window.CARREGIE_LAN && !!window.__dbg));
check('accueil : bloc réseau local', await A.evaluate(() => /Réseau local/.test(document.querySelector('.cs-lan')?.textContent || '')));
await A.locator('button', { hasText: 'Jouer à plusieurs' }).click();
await A.waitForTimeout(2500);
check('pas encore de partie : onglet Héberger proposé', await A.evaluate(() => document.querySelector('#modal .tab.on')?.textContent === 'Héberger une partie'));
await A.screenshot({ path: OUT + '/l1-lobby-heberger.png' });
await A.locator('#ses-pseudo').fill('Alice');
await A.locator('.ses-role', { has: A.locator('b', { hasText: /^Réalisateur$/ }) }).click();
await A.locator('#modal button', { hasText: 'Créer la partie' }).click();
check('Alice en jeu, hôte', await until(A, () => window.__dbg.SES.active && window.__dbg.S.mode === 'fps' && window.__dbg.SES.transport === 'lan', null, 90000));

// ---- Bruno rejoint (truquiste) ----
const B = await newPage('bruno');
await B.locator('button', { hasText: 'Jouer à plusieurs' }).click();
await until(B, () => /Partie de Alice/.test(document.querySelector('.ses-parties')?.textContent || ''), null, 20000);
check('Bruno voit la partie d\'Alice', await B.evaluate(() => /Partie de Alice/.test(document.querySelector('.ses-parties')?.textContent || '')));
await B.locator('#ses-pseudo').fill('Bruno');
await B.locator('.ses-role', { has: B.locator('b', { hasText: /^Truquiste$/ }) }).click();
check('rôle Réalisateur marqué « déjà pris par Alice »', await B.evaluate(() => [...document.querySelectorAll('.ses-role')].some((b) => /Réalisateur/.test(b.textContent) && /Alice/.test(b.textContent))));
await B.screenshot({ path: OUT + '/l2-lobby-rejoindre.png' });
await B.locator('#modal button.primary', { hasText: /^Rejoindre la partie$/ }).click();
const okB = await until(B, () => window.__dbg.SES.active && window.__dbg.S.mode === 'fps' && window.__dbg.SES.follower && window.__dbg.SES.buf.length > 0, null, 150000);
check('Bruno en jeu, suit le match', okB, okB ? '' : await B.evaluate(() => JSON.stringify({ a: window.__dbg.SES.active, m: window.__dbg.S.mode, f: window.__dbg.SES.follower, buf: window.__dbg.SES.buf.length, host: window.__dbg.SES.hostPeer && window.__dbg.SES.hostPeer.presence.name })));
check('pseudos des deux côtés', await until(A, () => window.__dbg.SES.peers.map((p) => p.presence && p.presence.name).sort().join(',') === 'Alice,Bruno'));

// ---- avatars : chacun voit l'autre, avec son étiquette ----
// on place les deux joueurs dans le compound, face à face
await A.evaluate(() => { const P = window.__dbg.PL; P.fly = false; window.__dbg.S.inTruck = false; P.pos.set(-12, 0, -104); P.yaw = 0; P.cyaw = 0; P.pitch = P.cpitch = -0.05; });
await B.evaluate(() => { const P = window.__dbg.PL; P.fly = false; window.__dbg.S.inTruck = false; P.pos.set(-12, 0, -108.5); P.yaw = Math.PI; P.cyaw = Math.PI; P.pitch = P.cpitch = -0.05; });
const okAv = await until(A, () => { const a = [...window.__dbg.AVATARS.list.values()][0]; return a && /Bruno/.test(a.tagKey) && /Truquiste/.test(a.tagKey) && a.pos && Math.abs(a.pos.z + 108.5) < 0.6; }, null, 90000);
check('avatar de Bruno chez Alice', okAv, okAv ? '' : await A.evaluate(() => JSON.stringify([...window.__dbg.AVATARS.list.values()].map((a) => ({ k: a.tagKey, p: a.pos, sc: !!a.scene })))));
check('avatar d\'Alice chez Bruno (hôte)', await until(B, () => { const a = [...window.__dbg.AVATARS.list.values()][0]; return a && /Alice/.test(a.tagKey) && /hôte/.test(a.tagKey); }));
await A.waitForTimeout(1500);
await A.screenshot({ path: OUT + '/l3-alice-voit-bruno.png' });
// Bruno marche : son avatar suit chez Alice
await B.evaluate(() => { window.__dbg.PL.pos.x = -9; });
check('déplacement suivi (lissé)', await until(A, () => { const a = [...window.__dbg.AVATARS.list.values()][0]; return a && Math.abs(a.pos.x + 9) < 0.3; }));

// ---- Bruno s'installe au mélangeur : assis au pupitre chez Alice ----
await B.evaluate(() => { const st = window.__dbg.T.stations.find((s) => s.id === 'melangeur'); window.__dbg.goToStation(st); });
await A.evaluate(() => { const st = window.__dbg.T.stations.find((s) => s.id === 'realisateur'); window.__dbg.goToStation(st, false); });
check('Bruno assis au mélangeur (vu par Alice)', await until(A, () => { const a = [...window.__dbg.AVATARS.list.values()][0]; return a && a.sit > 0.8 && a.scene === window.__dbg.T.scene; }));
await A.evaluate(() => { const P = window.__dbg.PL; P.yaw += 1.2; P.cyaw = P.yaw; P.pitch = P.cpitch = -0.2; });
await A.waitForTimeout(1500);
await A.screenshot({ path: OUT + '/l4-car-bruno-au-melangeur.png' });

// ---- l'hôte attribue un rôle : Chloé arrive en observatrice, Alice la fait cadreuse CAM 3 ----
const C = await newPage('chloe');
await C.locator('button', { hasText: 'Jouer à plusieurs' }).click();
await until(C, () => /Partie de Alice/.test(document.querySelector('.ses-parties')?.textContent || ''), null, 20000);
await C.locator('#ses-pseudo').fill('Chloé');
await C.locator('.ses-role', { has: C.locator('b', { hasText: /^Observateur$/ }) }).click();
await C.locator('#modal button.primary', { hasText: /^Rejoindre la partie$/ }).click();
check('Chloé en jeu', await until(C, () => window.__dbg.SES.active && window.__dbg.S.mode === 'fps', null, 90000));
await until(A, () => window.__dbg.SES.peers.length === 3);
await A.evaluate(() => window.__dbg.openSessionPanel()); await A.waitForSelector('#modal .tab', { timeout: 60000 }); await A.waitForTimeout(800);
const row = A.locator('#modal tr', { hasText: 'Chloé' });
await row.locator('select').first().selectOption('cadreur');
await row.locator('select').nth(1).selectOption('3');
check('Chloé reçoit le rôle Cadreur CAM 3', await until(C, () => window.__dbg.SES.role === 'cadreur' && window.__dbg.SES.cam === 3));
await A.screenshot({ path: OUT + '/l5-participants.png' });
await A.evaluate(() => document.querySelector('#modal .x')?.click());
// fiche de rôle de Chloé, bouton « Aller à la CAM 3 » : elle prend la caméra
check('fiche de rôle affichée (Cadreur)', await until(C, () => /Cadreur/.test(document.querySelector('#role-card')?.textContent || '')));
await C.screenshot({ path: OUT + '/l6-fiche-role.png' });
await C.locator('#role-card button', { hasText: 'Aller à la CAM 3' }).click();
check('Chloé cadre la CAM 3', await until(C, () => window.__dbg.S.mode === 'camop' && window.__dbg.S.camop && window.__dbg.S.camop.id === 3));
check('étiquette de Chloé au-dessus de la CAM 3 chez Alice', await until(A, () => [...window.__dbg.AVATARS.list.values()].some((a) => /Chloé/.test(a.tagKey) && !a.root.visible && a.tag.parent)));

// ---- ordre de la réalisatrice → le truquiste ----
await A.evaluate(() => window.__dbg.openStation('realisateur'));
await A.waitForTimeout(1000);
await A.locator('#station .hwpanel .hw').filter({ hasText: 'CAM 3' }).first().click();
check('Bruno reçoit « Prépare la 3 »', await until(B, () => /Prépare la 3/.test(document.getElementById('order-osd')?.textContent || ''), null, 20000));
await B.keyboard.press('KeyB'); await B.keyboard.press('Digit3');
check('le preset de Bruno arrive chez Alice', await until(A, () => window.__dbg.MIX.pst === 3));
check('objectif du truquiste : ordre exécuté', await until(B, () => /1 \/ 1/.test(document.querySelector('#role-card')?.textContent || '') || window.__dbg.S.mode === 'station'));

// ---- compte rendu écrit sur l'ordinateur de l'hôte ----
await A.evaluate(() => window.__dbg.closeStation());
await A.evaluate(() => { const S = window.__dbg.SES; S.role = 'formateur'; });
await A.evaluate(() => window.__dbg.openSessionPanel()); await A.waitForSelector('#modal .tab', { timeout: 60000 }); await A.waitForTimeout(600);
await A.locator('#modal .tab', { hasText: 'Formateur' }).click(); await A.waitForTimeout(400);
await A.locator('#modal button', { hasText: 'Enregistrer le compte rendu' }).click();
await A.waitForTimeout(2500);
const files = fs.existsSync(path.join(WORK, 'rapports')) ? fs.readdirSync(path.join(WORK, 'rapports')) : [];
check('compte rendu enregistré dans « rapports »', files.some((f) => f.endsWith('.html')) && files.some((f) => f.endsWith('.json')), files.join(', '));

// ---- départ : Bruno quitte, son avatar disparaît chez Alice ----
await B.context().browser().close();
check('départ de Bruno', await until(A, () => window.__dbg.SES.peers.length === 2 && ![...window.__dbg.AVATARS.list.values()].some((a) => /Bruno/.test(a.tagKey)), null, 40000));

// ---- le serveur redémarre : les joueurs se reconnectent seuls à la même partie ----
srv.kill(); await new Promise((r) => setTimeout(r, 1500));
check('coupure vue par les joueurs', await until(A, () => !window.__dbg.SES.connected, null, 20000));
const srv2 = spawn(process.execPath, [path.resolve('dist/car-regie-serveur-lan.mjs'), '--port', String(PORT)], { cwd: WORK });
srv2.stdout.on('data', (d) => { srvLog += d; });
servers.push(srv2);
check('reconnexion automatique, même partie, mêmes joueurs', await until(A, () => window.__dbg.SES.connected && window.__dbg.SES.peers.length === 2 && window.__dbg.SES.peers.some((p) => p.presence && p.presence.name === 'Chloé'), null, 60000));
check('Chloé toujours cadreuse CAM 3 après reconnexion', await until(A, () => window.__dbg.SES.peers.some((p) => p.presence && p.presence.name === 'Chloé' && p.presence.role === 'cadreur' && p.presence.cam === 3), null, 30000));
log('serveur :', srvLog.split('\n').filter((l) => /rejoint|quitte|rapport/.test(l)).slice(0, 8).join(' | '));
log('ERRORS', errors.length, errors.slice(0, 6).join('\n'));
log('FAILS', fails);
await closeAll();
srv2.kill();
process.exit(fails || errors.length ? 1 : 0);
