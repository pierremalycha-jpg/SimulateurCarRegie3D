// Réseau local : le vrai serveur (lan/serveur.mjs) lancé dans un dossier temporaire, et le client
// du jeu (src/multi/lan.js) branché dessus avec le WebSocket de Node. Vérifie le relais de la
// présence et des messages, les départs, la reconnexion d'un onglet, la liste des parties et
// l'enregistrement des comptes rendus.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import zlib from 'node:zlib';
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
  port = await freePort(); base = `http://127.0.0.1:${port}`;
  srv = spawn(process.execPath, ['serveur.mjs', '--port', String(port)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
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
