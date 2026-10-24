// Réseau local : le vrai serveur (lan/serveur.mjs) lancé dans un dossier temporaire, et le client
// du jeu (src/multi/lan.js) branché dessus avec le WebSocket de Node. Vérifie le relais de la
// présence et des messages, les départs, la reconnexion d'un onglet, la liste des parties,
// l'enregistrement des comptes rendus, et ce que le serveur refuse (v19.4) : une autre page web,
// un message fragmenté trop gros, une présence trop grosse ou piégée, trop de comptes rendus.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import zlib from 'node:zlib';
import http from 'node:http';
import crypto from 'node:crypto';
import { lanRoom } from '../../src/multi/lan.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
let dir, srv, base, port;
const clients = [];

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const until = async (cond, what, ms = 4000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('délai dépassé : ' + what); await new Promise((r) => setTimeout(r, 15)); } };
async function join(code, presence) {
  const r = await lanRoom().join(code);
  const c = { r, peers: [], msgs: [], changes: [] };
  r.onPeers((ch) => { c.peers = ch.peers; c.changes.push(ch); });
  r.on('ord', (m) => c.msgs.push(m));
  if (presence) await r.presence(presence);
  clients.push(c);
  return c;
}
const presenceOf = (c, name) => c.peers.find((p) => p.presence.name === name);

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'car-regie-lan-'));
  // version autonome, comme tools/build.mjs, avec une page minimale
  const page = '<!doctype html><html><body><!--LAN--><p>car régie</p></body></html>';
  const code = fs.readFileSync(path.join(ROOT, 'lan/serveur.mjs'), 'utf8').replace('let PAGE = null;', () => `let PAGE = ${JSON.stringify(page)};`);
  fs.writeFileSync(path.join(dir, 'serveur.mjs'), code);
  fs.copyFileSync(path.join(ROOT, 'lan/internet.mjs'), path.join(dir, 'internet.mjs'));
  port = await freePort(); base = `http://127.0.0.1:${port}`;
  // faux cloudflared : note la porte du tunnel qu'on lui donne, annonce une adresse, reste en vie
  fs.writeFileSync(path.join(dir, 'faux-cloudflared'), `#!${process.execPath}\nrequire('fs').writeFileSync(${JSON.stringify(path.join(dir, 'cf-args.json'))}, JSON.stringify(process.argv.slice(2)));\nconsole.error('INF |  https://essai-tiee.trycloudflare.com  |');\nsetInterval(() => {}, 1000);\n`);
  fs.chmodSync(path.join(dir, 'faux-cloudflared'), 0o755);
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"commonjs"}');
  srv = spawn(process.execPath, ['serveur.mjs', '--port', String(port)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TIEE_CLOUDFLARED: path.join(dir, 'faux-cloudflared') } });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  await until(() => out.includes(`localhost:${port}`), 'démarrage du serveur\n' + out);
  globalThis.location = /** @type {any} */ ({ protocol: 'http:', host: `127.0.0.1:${port}` });
});
after(async () => {
  for (const c of clients) await c.r.leave();
  srv && srv.kill();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

test('page servie avec le marqueur réseau local, compressée si demandé', async () => {
  const r = await fetch(base + '/', { headers: { 'accept-encoding': 'identity' } });
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /window\.CARREGIE_LAN = \{ version: 1 \}/);
  assert.ok(!html.includes('<!--LAN-->'));
  const gz = await new Promise((res, rej) => {
    import('node:http').then(({ get }) => get(base + '/', { headers: { 'accept-encoding': 'gzip' } }, (rs) => {
      const b = []; rs.on('data', (d) => b.push(d)); rs.on('end', () => res({ enc: rs.headers['content-encoding'], body: Buffer.concat(b) })); rs.on('error', rej);
    }));
  });
  assert.equal(gz.enc, 'gzip');
  assert.equal(zlib.gunzipSync(gz.body).toString('utf8'), html);
  assert.equal((await fetch(base + '/inconnu')).status, 404);
});

test('présence : chacun voit les autres, avec pseudo et rôle', async () => {
  const a = await join('car-test', { name: 'Alice', role: 'realisateur', since: 1, host: true });
  const b = await join('car-test', { name: 'Bob', role: 'truquiste', since: 2 });
  await until(() => presenceOf(a, 'Bob') && presenceOf(b, 'Alice'), 'présences croisées');
  assert.equal(presenceOf(b, 'Alice').presence.role, 'realisateur');
  assert.ok(b.peers.find((p) => p.presence.name === 'Bob').sameTab, 'chacun se reconnaît');
  // une clé à null est retirée
  await a.r.presence({ host: null, cam: 3 });
  await until(() => presenceOf(b, 'Alice').presence.cam === 3, 'mise à jour');
  assert.ok(!('host' in presenceOf(b, 'Alice').presence));
});

test('messages relayés aux autres, pas à l\'émetteur', async () => {
  const [a, b] = clients;
  await a.r.emit('ord', { kind: 'prep', n: 3 });
  await until(() => b.msgs.length === 1, 'ordre reçu');
  assert.deepEqual(b.msgs[0].data, { kind: 'prep', n: 3 });
  assert.equal(b.msgs[0].peer, presenceOf(b, 'Alice').peer);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(a.msgs.length, 0);
});

test('liste des parties du réseau', async () => {
  const j = await (await fetch(base + '/api/parties')).json();
  const p = j.parties.find((x) => x.code === 'car-test');
  assert.ok(p, JSON.stringify(j));
  assert.equal(p.count, 2);
  assert.deepEqual(p.players.map((x) => x.name).sort(), ['Alice', 'Bob']);
  assert.ok(j.server);
});

test('parties séparées : rien ne passe de l\'une à l\'autre', async () => {
  const z = await join('car-autre', { name: 'Zoé', role: 'son', since: 3 });
  await z.r.emit('ord', { kind: 'msg', text: 'ailleurs' });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(clients[1].msgs.length, 1);
  assert.ok(!presenceOf(clients[0], 'Zoé'));
});

test('un onglet qui se reconnecte remplace son ancienne connexion', async () => {
  const a = clients[0];
  globalThis.sessionStorage = /** @type {any} */ ({ getItem: () => 'tab-fixe', setItem() {} });
  try {
    const c1 = await join('car-test', { name: 'Chloé', role: 'son', since: 4 });
    await until(() => presenceOf(a, 'Chloé'), 'Chloé arrive');
    const old = presenceOf(a, 'Chloé').peer;
    const c2 = await join('car-test', { name: 'Chloé', role: 'son', since: 4 });
    await until(() => presenceOf(a, 'Chloé') && presenceOf(a, 'Chloé').peer !== old, 'nouvelle connexion');
    assert.equal(a.peers.filter((p) => p.presence.name === 'Chloé').length, 1, 'pas de fantôme');
    await c2.r.leave(); await c1.r.leave();
  } finally { delete globalThis.sessionStorage; }
  await until(() => !presenceOf(a, 'Chloé'), 'départ de Chloé');
});

test('départ : les autres sont prévenus', async () => {
  const [a, b] = clients;
  await b.r.leave();
  await until(() => !presenceOf(a, 'Bob'), 'Bob parti');
  assert.ok(a.changes.some((ch) => ch.left.some((p) => p.presence.name === 'Bob')));
  const j = await (await fetch(base + '/api/parties')).json();
  assert.equal(j.parties.find((x) => x.code === 'car-test').count, 1);
});

test('compte rendu enregistré dans « rapports »', async () => {
  const r = await fetch(base + '/api/rapport', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'test-1/../x', data: { ok: 1 }, html: '<p>rapport</p>' }) });
  const j = await r.json();
  assert.ok(j.ok, JSON.stringify(j));
  const f = path.join(dir, 'rapports');
  assert.deepEqual(fs.readdirSync(f).sort(), ['session-test-1x.html', 'session-test-1x.json'], 'nom de fichier nettoyé');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f, 'session-test-1x.json'), 'utf8')), { ok: 1 });
});

test('partie complète au-delà de 40 joueurs', async () => {
  const many = [];
  for (let i = 0; i < 40; i++) many.push(await join('car-pleine'));
  await assert.rejects(lanRoom().join('car-pleine'), (e) => e.code === 'full');
  for (const c of many) await c.r.leave();
});

test('sans port imposé : premier port libre à partir de 8080, et un second lancement renvoie au premier', async () => {
  const run = () => { const p = spawn(process.execPath, ['serveur.mjs'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }); const o = { p, out: '' }; p.stdout.on('data', (d) => { o.out += d; }); return o; };
  const a = run();
  try {
    await until(() => /localhost:(\d+)/.test(a.out), 'démarrage sans port\n' + a.out, 8000);
    const port = +a.out.match(/localhost:(\d+)/)[1];
    assert.ok(port >= 8080 && port < 8090, String(port));
    const b = run();
    const code = await new Promise((r) => b.p.on('exit', r));
    assert.equal(code, 0);
    assert.match(b.out, new RegExp(`tourne déjà sur cet ordinateur : http://localhost:${port}`));
  } finally { a.p.kill(); }
});

// ---------------- ce que le serveur refuse ----------------
// une connexion WebSocket écrite à la main (en-têtes au choix, trames brutes)
function rawUpgrade(headers = {}) {
  return new Promise((res, rej) => {
    const sock = net.connect(port, '127.0.0.1');
    const extra = Object.entries(headers).map(([k, v]) => `${k}: ${v}\r\n`).join('');
    sock.on('connect', () => sock.write(`GET /ws HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n${extra}\r\n`));
    sock.once('data', (d) => res({ sock, status: Number(String(d).split(' ')[1]) }));
    sock.on('error', rej);
  });
}
// trame d'un client (masque nul : les données passent telles quelles)
function frame(op, data, fin = true) {
  const n = data.length; let h;
  if (n < 126) { h = Buffer.alloc(2); h[1] = 0x80 | n; } else if (n < 65536) { h = Buffer.alloc(4); h[1] = 0x80 | 126; h.writeUInt16BE(n, 2); } else { h = Buffer.alloc(10); h[1] = 0x80 | 127; h.writeBigUInt64BE(BigInt(n), 2); }
  h[0] = (fin ? 0x80 : 0) | op;
  return Buffer.concat([h, Buffer.alloc(4), data]);
}
const closed = (sock) => new Promise((r) => { if (sock.destroyed) r(true); sock.on('close', () => r(true)); setTimeout(() => r(false), 4000); });
function post(pathname, body, headers) {
  return new Promise((res, rej) => {
    const rq = http.request({ host: '127.0.0.1', port, path: pathname, method: 'POST', headers }, (rs) => { let b = ''; rs.on('data', (d) => { b += d; }); rs.on('end', () => res({ status: rs.statusCode, body: b })); });
    rq.on('error', rej); rq.end(body);
  });
}

test('une autre page web ne se branche pas sur les parties ; la page du serveur, si', async () => {
  const bad = await rawUpgrade({ Origin: 'http://site-quelconque.example' });
  assert.equal(bad.status, 403); bad.sock.destroy();
  const ok = await rawUpgrade({ Origin: `http://127.0.0.1:${port}` });
  assert.equal(ok.status, 101); ok.sock.destroy();
});

test('un message fragmenté qui dépasse 4 Mo au total ferme la connexion, le serveur reste debout', async () => {
  const { sock, status } = await rawUpgrade();
  assert.equal(status, 101);
  const mo = Buffer.alloc(1024 * 1024, 0x20);
  sock.write(frame(1, mo, false));
  for (let i = 0; i < 4; i++) sock.write(frame(0, mo, false));
  assert.ok(await closed(sock), 'connexion fermée');
  assert.equal((await fetch(base + '/api/parties')).status, 200, 'le serveur répond toujours');
});

test('présence : une clé piégée est ignorée, une présence trop grosse n\'est pas relayée', async () => {
  const watcher = await join('car-garde', { name: 'Garde', role: 'son', since: 9 });
  const { sock } = await rawUpgrade();
  sock.write(frame(1, Buffer.from(JSON.stringify({ t: 'join', room: 'car-garde', by: 'brut', presence: { name: 'Brut', since: 10 } }))));
  await until(() => presenceOf(watcher, 'Brut'), 'Brut arrive');
  sock.write(frame(1, Buffer.from('{"t":"pres","patch":{"__proto__":{"pollue":1},"cam":4}}')));
  await until(() => presenceOf(watcher, 'Brut').presence.cam === 4, 'patch relayé');
  assert.ok(!Object.prototype.hasOwnProperty.call(presenceOf(watcher, 'Brut').presence, '__proto__'));
  assert.equal(/** @type {any} */ ({}).pollue, undefined);
  sock.write(frame(1, Buffer.from(JSON.stringify({ t: 'pres', patch: { gros: 'x'.repeat(70 * 1024) } }))));
  sock.write(frame(1, Buffer.from(JSON.stringify({ t: 'pres', patch: { cam: 5 } }))));
  await until(() => presenceOf(watcher, 'Brut').presence.cam === 5, 'patch suivant relayé');
  assert.ok(!('gros' in presenceOf(watcher, 'Brut').presence), 'la présence trop grosse n\'est pas passée');
  sock.destroy();
  await watcher.r.leave();
});

test('comptes rendus : même origine, JSON, et pas plus de quelques envois par minute', async () => {
  const body = JSON.stringify({ id: 'quota', data: { ok: 1 } });
  assert.equal((await post('/api/rapport', body, { 'content-type': 'application/json', origin: 'http://site-quelconque.example' })).status, 403, 'autre origine');
  assert.equal((await post('/api/rapport', body, { 'content-type': 'text/plain' })).status, 415, 'pas du JSON (formulaire d\'une autre page)');
  const codes = [];
  for (let i = 0; i < 8; i++) codes.push((await post('/api/rapport', body, { 'content-type': 'application/json', origin: `http://127.0.0.1:${port}` })).status);
  assert.ok(codes.includes(200), codes.join(','));
  assert.equal(codes.at(-1), 429, 'trop d\'envois : refusé, ' + codes.join(','));
});

// ---------------- par Internet (v19.5) ----------------
function get(p0, pathname, headers = {}) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: p0, path: pathname, headers }, (rs) => { let b = ''; rs.on('data', (d) => { b += d; }); rs.on('end', () => res({ status: rs.statusCode, headers: rs.headers, body: b })); }).on('error', rej);
  });
}
function upgradeOn(p0, pathname, headers = {}) {
  return new Promise((res, rej) => {
    const sock = net.connect(p0, '127.0.0.1');
    const extra = Object.entries(headers).map(([k, v]) => `${k}: ${v}\r\n`).join('');
    sock.on('connect', () => sock.write(`GET ${pathname} HTTP/1.1\r\nHost: 127.0.0.1:${p0}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n${extra}\r\n`));
    sock.once('data', (d) => { res(Number(String(d).split(' ')[1])); sock.destroy(); });
    sock.on('error', rej);
  });
}
const KEY = () => fs.readFileSync(path.join(dir, 'cle-internet.txt'), 'utf8').trim();

test('par Internet : la clé est gardée à côté du serveur ; l\'état n\'est lisible que par l\'hôte', async () => {
  assert.match(KEY(), /^[a-z2-9]{12}$/);
  const st = await get(port, '/api/internet', { host: `localhost:${port}` });
  assert.equal(st.status, 200);
  const j = JSON.parse(st.body);
  assert.equal(j.cle, KEY()); assert.equal(j.direct.etat, 'non'); assert.equal(j.tunnel.etat, 'non'); assert.equal(j.lien, null);
  // un nom de domaine qui pointerait vers cet ordinateur (« DNS rebinding ») ne lit pas la clé
  assert.equal((await get(port, '/api/internet', { host: 'site-quelconque.example' })).status, 403);
  assert.equal((await post('/api/internet/tunnel', '', { origin: 'http://site-quelconque.example' })).status, 405, 'une autre page ne lance pas le tunnel');
  // depuis le réseau local, pas de clé à donner (comme avant)
  assert.equal((await get(port, '/')).status, 200);
});

test('par Internet : tunnel lancé par l\'hôte, et rien sans la clé', async () => {
  const r = await post('/api/internet/tunnel', '', { origin: `http://127.0.0.1:${port}` });
  assert.equal(r.status, 200);
  let st;
  for (let i = 0; i < 100; i++) { st = JSON.parse((await get(port, '/api/internet')).body); if (st.tunnel.etat === 'pret') break; await new Promise((x) => setTimeout(x, 50)); }
  assert.equal(st.tunnel.etat, 'pret', JSON.stringify(st.tunnel));
  assert.equal(st.lien, `https://essai-tiee.trycloudflare.com/?cle=${KEY()}`);
  const args = JSON.parse(fs.readFileSync(path.join(dir, 'cf-args.json'), 'utf8'));
  assert.deepEqual(args.slice(0, 3), ['tunnel', '--no-autoupdate', '--url']);
  const tport = +new URL(args[3]).port;
  assert.ok(tport > 0 && tport !== port, 'le tunnel arrive par une porte à part');
  // tout ce qui arrive par le tunnel vient d'Internet
  const no = await get(tport, '/');
  assert.equal(no.status, 403); assert.match(no.body, /Lien incomplet/); assert.ok(!no.body.includes('CARREGIE_LAN'));
  assert.equal((await get(tport, '/?cle=faussecle123')).status, 403);
  assert.equal((await get(tport, '/api/parties')).status, 403);
  assert.equal(await upgradeOn(tport, '/ws'), 403, 'WebSocket sans clé');
  const yes = await get(tport, `/?lite&cle=${KEY()}`);
  assert.equal(yes.status, 200); assert.match(yes.body, /CARREGIE_LAN/);
  const cookie = String(yes.headers['set-cookie']).split(';')[0];
  assert.equal(cookie, `tiee_cle=${KEY()}`);
  assert.equal((await get(tport, '/api/parties', { cookie })).status, 200, 'la clé suit dans le cookie');
  assert.equal(await upgradeOn(tport, '/ws', { cookie }), 101);
  assert.equal(await upgradeOn(tport, `/ws?cle=${KEY()}`), 101, 'ou dans l\'adresse du WebSocket');
  assert.equal((await get(tport, '/api/internet', { cookie })).status, 403, 'l\'état et les commandes restent à l\'hôte');
  assert.equal(JSON.parse((await get(tport, '/api/ping')).body).ok, true);
  // le client du jeu, ouvert par le lien : il passe la clé au WebSocket
  const loc = globalThis.location;
  globalThis.location = /** @type {any} */ ({ protocol: 'http:', host: `127.0.0.1:${tport}`, search: `?lite&cle=${KEY()}` });
  try {
    const a = await join('car-internet', { name: 'Invitée' });
    globalThis.location = loc;
    const b = await join('car-internet', { name: 'Hôte' });
    await until(() => presenceOf(a, 'Hôte') && presenceOf(b, 'Invitée'), 'chacun voit l\'autre, par Internet et sur place');
  } finally { globalThis.location = loc; }
  // l'hôte referme : le tunnel s'arrête
  const f = JSON.parse((await post('/api/internet/fermer', '', { origin: `http://127.0.0.1:${port}` })).body);
  assert.equal(f.tunnel.etat, 'non');
});
