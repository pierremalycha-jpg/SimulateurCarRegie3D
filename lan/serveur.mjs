#!/usr/bin/env node
// @ts-check
// ----------------------------------------------------------------------------------
// TIEE Simulator — serveur réseau local (aucune dépendance : Node.js 18 ou plus récent)
//
//   node lan/serveur.mjs              (port 8080, ou le suivant s'il est pris)
//   node lan/serveur.mjs --port 9000  (port imposé)
//   node lan/serveur.mjs --ouvrir     (ouvre aussi la page dans le navigateur)
//
// TIEE-Simulator.exe (tools/exe.mjs) est ce même serveur dans un exécutable Windows, lancé avec
// --ouvrir --exe : rien à installer, et un second double-clic rouvre simplement la page.
//
// La personne qui héberge lance ce serveur sur son ordinateur. Les autres ouvrent, dans leur
// navigateur, l'adresse affichée (http://192.168.x.x:8080) : rien à installer de leur côté.
// · sert la page du simulateur (three.js inclus : pas besoin d'Internet) ;
// · relaie en temps réel les parties : présence de chaque joueur (pseudo, rôle, position,
//   états des postes) et messages (ordres, faits de jeu, commentaires) ;
// · enregistre les comptes rendus de session dans le dossier « rapports » à côté du serveur.
// ----------------------------------------------------------------------------------
import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argPort = process.argv.indexOf('--port');
const ASKED = +(argPort > 0 ? process.argv[argPort + 1] : process.env.PORT) || 0; // port imposé
let PORT = ASKED || 8080;
const OPEN = process.argv.includes('--ouvrir'); // ouvrir la page dans le navigateur une fois prêt
const EXE = process.argv.includes('--exe');     // lancé par TIEE-Simulator.exe (fenêtre de console à part)
const MAX_MSG = 4 * 1024 * 1024; // un message WebSocket ne dépasse jamais 4 Mo
const MAX_PEERS = 40;            // par partie

// ---------------- la page du simulateur ----------------
let PAGE = null; // version autonome : la page est intégrée ici à la construction (tools/build.mjs)
function loadPage() {
  if (PAGE) return PAGE;
  const f = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index-lan.html');
  if (!fs.existsSync(f)) { console.error(`Page introuvable : ${f}\nConstruisez-la d'abord : node tools/build.mjs`); process.exit(1); }
  return fs.readFileSync(f, 'utf8');
}
const html = loadPage().replace('<!--LAN-->', '<script>window.CARREGIE_LAN = { version: 1 };</script>');
const htmlBuf = Buffer.from(html, 'utf8');
const htmlGz = zlib.gzipSync(htmlBuf, { level: 9 });

// ---------------- parties ----------------
// partie = { code, created, peers: Map(id -> { id, by, ws, presence, updatedAt }) }
const ROOMS = new Map();
const rid = () => crypto.randomBytes(5).toString('hex');
function roomOf(code) {
  let r = ROOMS.get(code);
  if (!r) { r = { code, created: Date.now(), peers: new Map() }; ROOMS.set(code, r); }
  return r;
}
const peerView = (p) => ({ peer: p.id, by: p.by, presence: p.presence, updatedAt: p.updatedAt });
function partyList() {
  const out = [];
  for (const r of ROOMS.values()) {
    if (!r.peers.size) continue;
    const ps = [...r.peers.values()];
    const host = ps.find((p) => p.presence.host) || ps[0];
    out.push({
      code: r.code, created: r.created, count: ps.length, host: String(host.presence.name || 'hôte').slice(0, 40),
      players: ps.map((p) => ({ name: String(p.presence.name || '').slice(0, 40), role: String(p.presence.role || '').slice(0, 20), cam: p.presence.cam || null })),
    });
  }
  return out.sort((a, b) => a.created - b.created);
}

// ---------------- WebSocket (RFC 6455, sans extension) ----------------
class Conn {
  constructor(socket) {
    this.s = socket; this.buf = Buffer.alloc(0); this.frags = []; this.alive = true; this.room = null; this.peer = null;
    socket.on('data', (d) => this.onData(d));
    socket.on('close', () => this.onClose());
    socket.on('error', () => this.onClose());
  }
  onData(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    for (;;) {
      const b = this.buf; if (b.length < 2) return;
      const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_MSG) { this.close(1009); return; }
      const mk = masked ? 4 : 0;
      if (b.length < off + mk + len) return;
      let payload = b.subarray(off + mk, off + mk + len);
      if (masked) { const m = b.subarray(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      this.buf = b.subarray(off + mk + len);
      if (op === 8) { this.close(1000); return; }
      if (op === 9) { this.frame(10, payload); continue; }
      if (op === 10) { this.alive = true; continue; }
      if (op === 1 || op === 2 || op === 0) {
        this.frags.push(payload);
        if (!fin) continue;
        const msg = Buffer.concat(this.frags).toString('utf8'); this.frags = [];
        this.alive = true;
        let m; try { m = JSON.parse(msg); } catch (e) { continue; }
        try { onMessage(this, m); } catch (e) { console.error('message ignoré :', e.message); }
      }
    }
  }
  frame(op, data) {
    if (this.s.destroyed) return;
    const n = data.length; let h;
    if (n < 126) { h = Buffer.alloc(2); h[1] = n; }
    else if (n < 65536) { h = Buffer.alloc(4); h[1] = 126; h.writeUInt16BE(n, 2); }
    else { h = Buffer.alloc(10); h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
    h[0] = 0x80 | op;
    this.s.write(Buffer.concat([h, data]));
  }
  send(obj) { this.frame(1, Buffer.from(JSON.stringify(obj), 'utf8')); }
  close(code = 1000) { const c = Buffer.alloc(2); c.writeUInt16BE(code); this.frame(8, c); this.s.end(); this.onClose(); }
  onClose() { if (this.closed) return; this.closed = true; leave(this); }
}
const CONNS = new Set();

function broadcast(room, obj, except) {
  const data = Buffer.from(JSON.stringify(obj), 'utf8');
  for (const p of room.peers.values()) if (p.ws !== except) p.ws.frame(1, data);
}
function onMessage(c, m) {
  if (m.t === 'ping') { c.send({ t: 'pong' }); return; }
  if (m.t === 'join') {
    if (c.room) leave(c);
    const code = String(m.room || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'car-local';
    const room = roomOf(code);
    if (room.peers.size >= MAX_PEERS) { c.send({ t: 'error', code: 'full', message: 'Partie complète.' }); return; }
    const presence = m.presence && typeof m.presence === 'object' ? m.presence : {};
    // le même onglet qui se reconnecte (Wi-Fi qui a décroché) : on retire l'ancienne connexion
    if (m.by) for (const q of [...room.peers.values()]) if (q.by === String(m.by).slice(0, 40)) { q.ws.room = null; q.ws.peer = null; room.peers.delete(q.id); broadcast(room, { t: 'left', peer: q.id }); try { q.ws.s.destroy(); } catch (e) { /* déjà fermée */ } }
    const p = { id: rid(), by: String(m.by || '').slice(0, 40) || null, ws: c, presence: clean(presence), updatedAt: Date.now() };
    room.peers.set(p.id, p); c.room = room; c.peer = p;
    c.send({ t: 'welcome', you: p.id, room: code, peers: [...room.peers.values()].map(peerView) });
    broadcast(room, { t: 'join', peer: peerView(p) }, c);
    if (p.presence.name) announced(p, room);
    return;
  }
  if (!c.room || !c.peer) return;
  if (m.t === 'pres' && m.patch && typeof m.patch === 'object') {
    const pr = c.peer.presence;
    for (const k of Object.keys(m.patch)) { if (m.patch[k] === null) delete pr[k]; else pr[k] = m.patch[k]; }
    c.peer.updatedAt = Date.now();
    if (!c.peer.told && pr.name) announced(c.peer, c.room);
    broadcast(c.room, { t: 'pres', peer: c.peer.id, patch: m.patch, at: c.peer.updatedAt }, c);
    return;
  }
  if (m.t === 'emit' && typeof m.topic === 'string') {
    broadcast(c.room, { t: 'msg', peer: c.peer.id, by: c.peer.by, topic: m.topic.slice(0, 40), data: m.data ?? null }, c);
    return;
  }
  if (m.t === 'leave') leave(c);
}
// journal de la console : arrivées (dès que le pseudo est connu), départs
function announced(p, room) { p.told = true; console.log(`${hhmm()}  + ${p.presence.name} rejoint la partie « ${room.code.replace(/^car-/, '')} » (${room.peers.size} en ligne)`); }
function clean(o) { const r = {}; for (const k of Object.keys(o)) if (o[k] !== null) r[k] = o[k]; return r; }
function leave(c) {
  const room = c.room, p = c.peer; if (!room || !p) return;
  room.peers.delete(p.id); c.room = null; c.peer = null;
  broadcast(room, { t: 'left', peer: p.id });
  console.log(`${hhmm()}  - ${p.presence.name || 'un joueur'} quitte la partie « ${room.code.replace(/^car-/, '')} » (${room.peers.size} en ligne)`);
  if (!room.peers.size) ROOMS.delete(room.code);
}
// connexions mortes (Wi-Fi coupé, portable en veille) : ping toutes les 15 s
setInterval(() => {
  for (const c of CONNS) {
    if (c.closed) { CONNS.delete(c); continue; }
    if (!c.alive) { c.s.destroy(); c.onClose(); CONNS.delete(c); continue; }
    c.alive = false; c.frame(9, Buffer.alloc(0));
  }
}, 15000).unref();

// ---------------- HTTP ----------------
function readBody(req, limit) {
  return new Promise((res, rej) => {
    const chunks = []; let n = 0;
    req.on('data', (d) => { n += d.length; if (n > limit) { rej(new Error('trop gros')); req.destroy(); } else chunks.push(d); });
    req.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rej);
  });
}
const RAPPORTS = path.join(process.cwd(), 'rapports');
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const json = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', ...(gz ? { 'content-encoding': 'gzip' } : {}) });
      res.end(gz ? htmlGz : htmlBuf); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/parties') { json(200, { parties: partyList(), server: serverName() }); return; }
    if (req.method === 'POST' && url.pathname === '/api/rapport') {
      const body = JSON.parse(await readBody(req, 4 * 1024 * 1024));
      const id = String(body.id || Date.now()).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60) || String(Date.now());
      fs.mkdirSync(RAPPORTS, { recursive: true });
      fs.writeFileSync(path.join(RAPPORTS, `session-${id}.json`), JSON.stringify(body.data ?? null, null, 1));
      if (typeof body.html === 'string') fs.writeFileSync(path.join(RAPPORTS, `session-${id}.html`), body.html);
      console.log(`${hhmm()}  compte rendu enregistré : rapports/session-${id}`);
      json(200, { ok: true, file: `rapports/session-${id}` }); return;
    }
    if (req.method === 'GET' && url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Introuvable');
  } catch (e) { json(400, { ok: false, message: e.message }); }
});
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (new URL(req.url, 'http://local').pathname !== '/ws' || !key || String(req.headers.upgrade).toLowerCase() !== 'websocket') { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  /** @type {import('node:net').Socket} */ (socket).setNoDelay(true);
  CONNS.add(new Conn(socket));
});

function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address });
  return out;
}
const serverName = () => os.hostname();
const hhmm = () => new Date().toLocaleTimeString('fr-FR');

// erreur fatale : dans l'exécutable, la fenêtre reste ouverte le temps de lire le message
function fatal() {
  if (!EXE || !process.stdin.isTTY) process.exit(1);
  console.error('\n  Appuyez sur Entrée pour fermer cette fenêtre.');
  process.stdin.resume(); process.stdin.once('data', () => process.exit(1));
}
function openBrowser(url) {
  // Windows : « start » de cmd, arguments passés tels quels (le titre vide "" ne doit pas être réécrit)
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    const c = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true, windowsVerbatimArguments: true });
    c.on('error', () => console.log(`  Ouvrez vous-même ${url} dans votre navigateur.`)); c.unref();
  } catch (e) { console.log(`  Ouvrez vous-même ${url} dans votre navigateur.`); }
}
// ce port est-il tenu par un serveur TIEE Simulator déjà lancé (second double-clic) ?
const isOurs = (port) => new Promise((res) => {
  const req = http.get({ host: '127.0.0.1', port, path: '/api/parties', timeout: 1500 }, (r) => {
    let b = ''; r.setEncoding('utf8'); r.on('data', (d) => { b += d; });
    r.on('end', () => { try { res(Array.isArray(JSON.parse(b).parties)); } catch (e) { res(false); } });
  });
  req.on('timeout', () => req.destroy()); req.on('error', () => res(false));
});
let tries = 0;
server.on('error', async (/** @type {NodeJS.ErrnoException} */ e) => {
  if (e.code === 'EADDRINUSE' && !ASKED) {
    if (await isOurs(PORT)) {
      console.log(`\n  TIEE Simulator tourne déjà sur cet ordinateur : http://localhost:${PORT}`);
      if (OPEN) { console.log('  La page s\'ouvre dans votre navigateur.'); openBrowser(`http://localhost:${PORT}`); }
      setTimeout(() => process.exit(0), EXE ? 4000 : 0);
      return;
    }
    // port pris par un autre logiciel : on essaie les suivants
    if (++tries < 10) { PORT++; server.close(); server.listen(PORT, '0.0.0.0'); return; }
  }
  if (e.code === 'EADDRINUSE') console.error(`Le port ${PORT} est déjà utilisé. Essayez : ${EXE ? 'TIEE-Simulator.exe' : 'node car-regie-serveur-lan.mjs'} --port ${PORT + 1}`);
  else console.error(e);
  fatal();
});
server.listen(PORT, '0.0.0.0', () => {
  const ips = lanAddresses();
  console.log('\n  TIEE Simulator · serveur réseau local\n');
  console.log(`  Sur cet ordinateur : http://localhost:${PORT}`);
  if (ips.length) for (const a of ips) console.log(`  Pour les autres     : http://${a.address}:${PORT}   (${a.name})`);
  else console.log('  Aucune carte réseau trouvée : branchez-vous au réseau local (câble ou Wi-Fi).');
  console.log('\n  Tout le monde doit être sur le même réseau. Si personne ne peut se connecter, autorisez');
  console.log(`  ${EXE ? 'TIEE Simulator' : 'Node.js'} dans le pare-feu (réseau privé). ${EXE ? 'Fermez cette fenêtre' : 'Ctrl+C'} pour arrêter.\n`);
  if (OPEN) openBrowser(`http://localhost:${PORT}`);
});
