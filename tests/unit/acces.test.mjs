// Accès par mot de passe de TIEE-Simulator.exe : le coffre (lan/coffre.mjs : chiffrement de la page,
// mauvais mot de passe, coffre altéré), le serveur protégé assemblé par tools/protege.mjs (ni la page
// ni le mot de passe en clair), et ce qu'il sert avant et après le mot de passe : écran « Accès
// réservé », parties, WebSocket, Internet, jeton par navigateur, essais limités.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { chiffrer, ouvrir, estCoffre } from '../../lan/coffre.mjs';
import { serveurProtege, mdpRefuse, mdpFaible } from '../../tools/protege.mjs';

const MDP = 'la régie mobile du lycée';
const PETIT = { N: 2 ** 12, r: 8, p: 1 }; // scrypt allégé : des tests rapides (l'exécutable garde KDF)
const PAGE = '<!doctype html><html><body><!--LAN--><p>Olivier, chef de car : page secrète</p></body></html>';
let dir, srv, base, port, code;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const until = async (cond, what, ms = 8000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('délai dépassé : ' + what); await new Promise((r) => setTimeout(r, 15)); } };
const acces = (mdp, headers = {}) => fetch(base + '/api/acces', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ mdp }) });
const jeton = (r) => String(r.headers.get('set-cookie') || '').split(';')[0];
// réponse du serveur à une demande de WebSocket (101 : acceptée)
const upgrade = (extra = '') => new Promise((res) => {
  const sock = net.connect(port, '127.0.0.1');
  sock.on('connect', () => sock.write(`GET /ws HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n${extra}\r\n`));
  sock.once('data', (d) => { res(+String(d).split(' ')[1]); sock.destroy(); });
  sock.on('error', () => res(0));
});

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiee-acces-'));
  await serveurProtege({ page: PAGE, mdp: MDP, kdf: PETIT, outfile: path.join(dir, 'serveur.mjs') });
  code = fs.readFileSync(path.join(dir, 'serveur.mjs'), 'utf8');
  port = await freePort(); base = `http://127.0.0.1:${port}`;
  srv = spawn(process.execPath, ['serveur.mjs', '--port', String(port)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  await until(() => out.includes(`localhost:${port}`), 'démarrage du serveur\n' + out);
  assert.match(out, /Accès protégé/);
});
after(() => { srv && srv.kill(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

test('coffre : le bon mot de passe ouvre, un mauvais ou un coffre modifié non', async () => {
  const c = await chiffrer('bonjour le car', 'mot de passe juste', PETIT);
  assert.ok(estCoffre(c)); assert.ok(!estCoffre('<html>')); assert.ok(!estCoffre(null));
  assert.equal((await ouvrir(c, 'mot de passe juste')).html.toString('utf8'), 'bonjour le car');
  assert.equal(await ouvrir(c, 'mot de passe faux'), null);
  const d = Buffer.from(c.data, 'base64'); d[3] ^= 1;
  assert.equal(await ouvrir({ ...c, data: d.toString('base64') }, 'mot de passe juste'), null, 'GCM refuse un coffre altéré');
  // sel et IV tirés au hasard : deux coffres du même texte ne se ressemblent pas
  const c2 = await chiffrer('bonjour le car', 'mot de passe juste', PETIT);
  assert.notEqual(c.data, c2.data);
});

test('mot de passe absent ou trop court refusé à la construction ; court accepté avec un avertissement', () => {
  assert.ok(mdpRefuse('')); assert.ok(mdpRefuse('ab')); assert.ok(mdpRefuse('x'.repeat(300)));
  assert.equal(mdpRefuse('xyz'), ''); assert.ok(mdpFaible('xyz'));
  assert.equal(mdpRefuse(MDP), ''); assert.equal(mdpFaible(MDP), '');
});

test('le serveur protégé ne contient ni la page ni le mot de passe', () => {
  assert.ok(!code.includes('page secrète') && !code.includes('Olivier'));
  assert.ok(!code.includes(MDP));
  assert.match(code, /data:image\/png;base64,/, 'logo de l\'écran « Accès réservé » intégré');
});

test('sans mot de passe : écran « Accès réservé », rien d\'autre', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /Accès réservé/); assert.match(html, /type="password"/);
  assert.ok(!html.includes('page secrète') && !html.includes('CARREGIE_LAN'));
  assert.equal((await fetch(base + '/api/parties')).status, 401);
  assert.equal((await fetch(base + '/api/rapport', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 401);
  assert.equal((await fetch(base + '/api/internet')).status, 403);
  assert.equal(await upgrade(), 403, 'WebSocket refusé');
  assert.equal(await upgrade('Cookie: tiee_acces=0123456789abcdef\r\n'), 403, 'faux jeton refusé');
  const ping = await (await fetch(base + '/api/ping')).json();
  assert.equal(ping.app, 'TIEE Simulator', 'le second double-clic reconnaît le serveur');
});

test('mauvais mot de passe, autre page web : refusés', async () => {
  const r = await acces('pas le bon mot de passe');
  assert.equal(r.status, 401); assert.equal((await r.json()).message, 'Mot de passe incorrect.');
  assert.equal(jeton(r), '');
  assert.equal((await acces(MDP, { origin: 'http://ailleurs.example' })).status, 403);
  assert.equal((await fetch(base + '/api/acces', { method: 'POST', body: 'mdp=' + MDP })).status, 415);
});

test('bon mot de passe : la page, puis tout le reste, pour ce navigateur seulement', async () => {
  const r = await acces(MDP);
  assert.equal(r.status, 200);
  const cookie = jeton(r);
  assert.match(cookie, /^tiee_acces=[0-9a-f]{48}$/);
  assert.match(String(r.headers.get('set-cookie')), /HttpOnly/);
  const html = await (await fetch(base + '/', { headers: { cookie } })).text();
  assert.match(html, /page secrète/); assert.match(html, /window\.CARREGIE_LAN = \{ version: 1 \}/);
  assert.ok(Array.isArray((await (await fetch(base + '/api/parties', { headers: { cookie } })).json()).parties));
  assert.equal(await upgrade(`Cookie: ${cookie}\r\n`), 101);
  assert.equal((await fetch(base + '/api/internet', { headers: { cookie } })).status, 200, 'l\'hôte, sur cet ordinateur');
  // un autre navigateur : toujours l'écran d'accès, puis son propre jeton (coffre déjà ouvert)
  assert.match(await (await fetch(base + '/')).text(), /Accès réservé/);
  assert.equal((await acces('encore un mauvais')).status, 401);
  const r2 = await acces(MDP);
  assert.equal(r2.status, 200); assert.notEqual(jeton(r2), cookie);
});

test('essais limités : au-delà de cinq ratés par minute, le serveur refuse d\'essayer', async () => {
  let last = 0;
  for (let i = 0; i < 6 && last !== 429; i++) last = (await acces('essai ' + i)).status;
  assert.equal(last, 429);
  assert.equal((await acces(MDP)).status, 429, 'même le bon, le temps de la pause');
});
