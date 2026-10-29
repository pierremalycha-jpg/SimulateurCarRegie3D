// Jouer par Internet (v19.7) : vrai serveur (dist/car-regie-serveur-lan.mjs) et deux navigateurs.
// Alice héberge sur son ordinateur ; elle demande un lien (pas de box UPnP ici : échec expliqué, puis
// lien par tunnel). Le tunnel est un faux cloudflared : il annonce une adresse trycloudflare et note
// la porte du tunnel, par laquelle Bruno arrive exactement comme depuis Internet (clé exigée).
// Bruno rejoint la partie d'Alice, chacun voit l'avatar de l'autre. Chloé, avec l'exécutable chez elle
// (page servie par son propre serveur), colle le lien reçu dans le salon.
// node tests/e2e/internet.mjs [dossier]
import { launch, openPage, outDir, until, closeAll } from './harness.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
const OUT = outDir('internet');
const PORT = 8000 + Math.floor(Math.random() * 900);
const WORK = path.join(OUT, 'srv'); fs.rmSync(WORK, { recursive: true, force: true }); fs.mkdirSync(WORK, { recursive: true });
const FAKE = path.join(WORK, 'faux-cloudflared'), ARGS = path.join(WORK, 'cf-args.json');
fs.writeFileSync(FAKE, `#!${process.execPath}\nrequire('fs').writeFileSync(${JSON.stringify(ARGS)}, JSON.stringify(process.argv.slice(2)));\nconsole.error('INF |  https://essai-tiee.trycloudflare.com  |');\nsetInterval(() => {}, 1000);\n`);
fs.chmodSync(FAKE, 0o755);
fs.writeFileSync(path.join(WORK, 'package.json'), '{"type":"commonjs"}');
const srv = spawn(process.execPath, [path.resolve('dist/car-regie-serveur-lan.mjs'), '--port', String(PORT)], { cwd: WORK, env: { ...process.env, TIEE_CLOUDFLARED: FAKE } });
let srvLog = '';
process.on('exit', () => { try { srv.kill(); } catch (e) { /* déjà arrêté */ } });
srv.stdout.on('data', (d) => { srvLog += d; }); srv.stderr.on('data', (d) => { srvLog += d; });
for (let i = 0; i < 50 && !srvLog.includes('localhost'); i++) await new Promise((r) => setTimeout(r, 100));
const KEY = fs.readFileSync(path.join(WORK, 'cle-internet.txt'), 'utf8').trim();

const errors = []; let fails = 0;
const log = (...a) => console.log(...a);
const check = (n, ok, x = '') => { if (!ok) fails++; log(ok ? 'OK  ' : 'FAIL', n, x); };
const newPage = async (id, url) => openPage(await launch(), {
  id, errors, url, ready: '!!window.__dbg && !!document.querySelector("#start .jouer")',
  before: (page) => page.addInitScript(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } }),
});
const openSalon = async (P) => { await P.locator('.jo-team-seg button[data-v="coop"]').click(); await P.locator('#st-antenne').click(); await P.waitForSelector('#modal .salon', { timeout: 60000 }); };

// ---- Alice, sur l'ordinateur qui héberge ----
const A = await newPage('alice', `http://localhost:${PORT}/?lite`);
await openSalon(A);
check('salon de l\'hôte : bloc « Inviter quelqu\'un par Internet »', await until(A, () => /Inviter quelqu'un par Internet/.test(document.querySelector('.ses-net')?.textContent || ''), null, 15000));
check('adresse du salon : la carte réseau, pas « localhost »', await until(A, () => /^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/.test(document.querySelector('.sl-addr')?.textContent || ''), null, 10000), await A.evaluate(() => document.querySelector('.sl-addr')?.textContent));
await A.screenshot({ path: OUT + '/i1-salon-hote.png' });
await A.locator('.ses-net button', { hasText: 'Inviter par Internet' }).click();
// ici, pas de box UPnP : l'échec est expliqué et le tunnel proposé
check('pas de box : raison en clair, tunnel proposé', await until(A, () => /La box n'a pas été ouverte/.test(document.querySelector('.ses-net')?.textContent || '') && !!document.querySelector('.ses-net button.primary'), null, 20000), await A.evaluate(() => document.querySelector('.ses-net')?.textContent));
await A.locator('.ses-net details summary').click();
check('analyse du réseau : cette carte, le port, la marche à suivre à la main', await A.evaluate((k) => { const t = document.querySelector('.sn-detail')?.textContent || ''; return /Cet ordinateur/.test(t) && /non ouvert/.test(t) && t.includes('?cle=' + k); }, KEY));
await A.screenshot({ path: OUT + '/i2-sans-box.png' });
await A.locator('.ses-net button', { hasText: 'Créer un lien par tunnel' }).click();
const LINK = `https://essai-tiee.trycloudflare.com/?cle=${KEY}`;
check('lien par tunnel affiché, avec la clé', await until(A, (l) => document.querySelector('.sn-url')?.textContent === l, LINK, 15000));
await A.screenshot({ path: OUT + '/i3-lien-tunnel.png' });
check('lien écrit aussi dans la fenêtre du serveur', srvLog.includes('Lien par tunnel : ' + LINK));
const tport = +new URL(JSON.parse(fs.readFileSync(ARGS, 'utf8'))[3]).port;
// Alice crée la partie
await A.locator('#modal .tab', { hasText: 'Créer une partie' }).click();
await A.locator('#ses-pseudo').fill('Alice');
await A.locator('.ses-role', { has: A.locator('b', { hasText: /^Réalisateur$/ }) }).click();
await A.locator('#modal button', { hasText: 'Créer la partie' }).click();
check('Alice en jeu, hôte', await until(A, () => window.__dbg.SES.active && window.__dbg.S.mode === 'fps', null, 90000));

// ---- quelqu'un qui n'a pas la clé ----
const X = await (await launch()).newPage();
await X.goto(`http://127.0.0.1:${tport}/`);
check('sans la clé : « Lien incomplet », rien du simulateur', /Lien incomplet/.test(await X.textContent('body')) && !(await X.content()).includes('CARREGIE_LAN'));
await X.screenshot({ path: OUT + '/i4-sans-cle.png' });

// ---- Bruno, chez lui : il ouvre le lien (arrive par le tunnel) ----
const B = await newPage('bruno', `http://127.0.0.1:${tport}/?lite&cle=${KEY}`);
await openSalon(B);
check('Bruno : bandeau « Par Internet »', await until(B, () => /Par Internet/.test(document.querySelector('.ses-banner')?.textContent || '')));
check('Bruno : pas de bloc d\'invitation (réservé à l\'hôte)', await B.evaluate(() => !document.querySelector('.ses-net')));
await until(B, () => /Partie de Alice/.test(document.querySelector('.ses-parties')?.textContent || ''), null, 20000);
check('Bruno voit la partie d\'Alice', await B.evaluate(() => /Partie de Alice/.test(document.querySelector('.ses-parties')?.textContent || '')));
await B.locator('#ses-pseudo').fill('Bruno');
await B.locator('.ses-role', { has: B.locator('b', { hasText: /^Truquiste$/ }) }).click();
await B.screenshot({ path: OUT + '/i5-bruno-salon.png' });
await B.locator('#modal button.primary', { hasText: /^Rejoindre la partie$/ }).click();
check('Bruno : bande d\'état « Par Internet »', await until(B, () => /Par Internet/.test(document.body.textContent || ''), null, 30000));
check('Bruno en jeu, suit le match d\'Alice', await until(B, () => window.__dbg.SES.active && window.__dbg.S.mode === 'fps' && window.__dbg.SES.follower && window.__dbg.SES.buf.length > 0, null, 150000));

// ---- avatars : chacun voit l'autre ----
await A.evaluate(() => { const P = window.__dbg.PL; P.fly = false; window.__dbg.S.inTruck = false; P.pos.set(-12, 0, -104); P.yaw = 0; P.cyaw = 0; P.pitch = P.cpitch = -0.05; });
await B.evaluate(() => { const P = window.__dbg.PL; P.fly = false; window.__dbg.S.inTruck = false; P.pos.set(-12, 0, -108.5); P.yaw = Math.PI; P.cyaw = Math.PI; P.pitch = P.cpitch = -0.05; });
check('avatar de Bruno chez Alice', await until(A, () => { const a = [...window.__dbg.AVATARS.list.values()][0]; return a && /Bruno/.test(a.tagKey) && a.pos && Math.abs(a.pos.z + 108.5) < 0.6; }, null, 90000));
check('avatar d\'Alice chez Bruno', await until(B, () => { const a = [...window.__dbg.AVATARS.list.values()][0]; return a && /Alice/.test(a.tagKey) && a.pos && Math.abs(a.pos.z + 104) < 0.6; }, null, 60000));
await A.waitForTimeout(1500); await B.waitForTimeout(500);
await A.screenshot({ path: OUT + '/i6-alice-voit-bruno.png' });
await B.screenshot({ path: OUT + '/i7-bruno-voit-alice.png' });

// ---- Chloé, avec l'exécutable chez elle : elle colle le lien dans son salon ----
fs.mkdirSync(path.join(WORK, 'chloe'), { recursive: true });
const PORT2 = PORT + 1;
const srv2 = spawn(process.execPath, [path.resolve('dist/car-regie-serveur-lan.mjs'), '--port', String(PORT2)], { cwd: path.join(WORK, 'chloe') });
process.on('exit', () => { try { srv2.kill(); } catch (e) { /* déjà arrêté */ } });
let log2 = ''; srv2.stdout.on('data', (d) => { log2 += d; });
for (let i = 0; i < 50 && !log2.includes('localhost'); i++) await new Promise((r) => setTimeout(r, 100));
const C = await newPage('chloe', `http://localhost:${PORT2}/?lite`);
await openSalon(C);
await C.locator('#modal .tab', { hasText: 'Rejoindre une partie' }).click();
check('Chloé : champ « Tu as reçu un lien de l\'hôte ? »', await until(C, () => !!document.querySelector('.ses-linkjoin input'), null, 10000));
await C.locator('.ses-linkjoin input').fill(`127.0.0.1:${tport}/?lite&cle=${KEY}`); // recopié sans « http:// »
await C.screenshot({ path: OUT + '/i8-chloe-colle-le-lien.png' });
await C.locator('.ses-linkjoin button', { hasText: 'Rejoindre' }).click();
check('le lien collé ouvre la partie de l\'hôte', await until(C, (p) => location.port === String(p) && !!window.__dbg && !!document.querySelector('#start .jouer'), tport, 60000));
await C.evaluate(() => window.__dbg.title && window.__dbg.title.enter('start')); // nouvelle adresse : l'écran titre revient
await openSalon(C);
check('Chloé voit la partie d\'Alice, par Internet', await until(C, () => /Partie de Alice/.test(document.querySelector('.ses-parties')?.textContent || '') && /Par Internet/.test(document.querySelector('.ses-banner')?.textContent || ''), null, 20000));

// ---- Alice referme l'accès ----
await A.evaluate(() => window.__dbg.openSessionPanel()); await A.waitForSelector('#modal .ses-net', { timeout: 60000 });
await until(A, () => /Fermer l'accès par Internet/.test(document.querySelector('.ses-net')?.textContent || ''), null, 10000);
await A.screenshot({ path: OUT + '/i9-participants-hote.png' });
await A.locator('.ses-net button', { hasText: 'Fermer l\'accès par Internet' }).click();
check('accès fermé : le bloc revient au bouton de départ', await until(A, () => /Inviter par Internet/.test(document.querySelector('.ses-net button')?.textContent || ''), null, 10000));
log('serveur :', srvLog.split('\n').filter((l) => /Lien|rejoint|box/i.test(l)).slice(0, 8).join(' | '));
log('ERRORS', errors.length, errors.slice(0, 6).join('\n'));
log('FAILS', fails);
await closeAll();
srv.kill(); srv2.kill();
process.exit(fails || errors.length ? 1 : 0);
