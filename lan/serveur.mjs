#!/usr/bin/env node
// @ts-check
// ----------------------------------------------------------------------------------
// TIEE Simulator — serveur réseau local (aucune dépendance : Node.js 18 ou plus récent)
//
//   node lan/serveur.mjs              (port 8080, ou le suivant s'il est pris)
//   node lan/serveur.mjs --port 9000  (port imposé)
//   node lan/serveur.mjs --ouvrir     (ouvre aussi la page dans le navigateur)
//   node lan/serveur.mjs --internet   (ouvre aussi la box pour jouer par Internet, voir plus bas)
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
//
// Par Internet (lan/internet.mjs) : depuis le salon, l'hôte demande un lien. Le serveur ouvre la box
// (UPnP) ou passe par un tunnel Cloudflare. Une connexion venue d'Internet doit porter la clé du lien
// (?cle=…, gardée ensuite dans un cookie) : sans elle, rien n'est servi. La clé est gardée dans
// « cle-internet.txt » à côté du serveur (un lien reste valable d'un lancement à l'autre ; effacer le
// fichier rend les anciens liens inutilisables).
// ----------------------------------------------------------------------------------
import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInternet, isPrivateAddr, lanAddresses } from './internet.mjs';

const argPort = process.argv.indexOf('--port');
const ASKED = +(argPort > 0 ? process.argv[argPort + 1] : process.env.PORT) || 0; // port imposé
let PORT = ASKED || 8080;
const OPEN = process.argv.includes('--ouvrir'); // ouvrir la page dans le navigateur une fois prêt
const EXE = process.argv.includes('--exe');     // lancé par TIEE-Simulator.exe (fenêtre de console à part)
const NET_AT_START = process.argv.includes('--internet'); // ouvrir la box dès le lancement
// limites : le serveur tourne sur le réseau du lycée, ouvert à tous ceux qui y sont branchés ; un
// client qui se trompe (ou qui s'amuse) ne doit pouvoir ni remplir la mémoire ni le disque de l'hôte
const MAX_MSG = 4 * 1024 * 1024;  // un message WebSocket (tous ses fragments) ne dépasse jamais 4 Mo
const MAX_PEERS = 40;             // joueurs par partie
const MAX_ROOMS = 50;             // parties ouvertes en même temps
const MAX_CONNS = 300;            // connexions WebSocket en tout
const MAX_CONNS_IP = 20;          // par adresse (sauf cet ordinateur : la machine de l'hôte et les tests)
const MAX_PRES = 64 * 1024;       // présence d'un joueur (pseudo, rôle, position, états), en JSON
const MAX_PRES_KEYS = 60;
const RAPPORT_MAX = 4 * 1024 * 1024;  // un compte rendu
const RAPPORTS_MAX = 500;             // comptes rendus gardés dans « rapports » (les plus anciens restent, les suivants sont refusés)
const RAPPORT_PAR_MIN = 6;            // envois de comptes rendus par minute et par adresse

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

// ---------------- clé des liens Internet ----------------
const INSTANCE = crypto.randomBytes(8).toString('hex'); // reconnaître ce serveur quand il s'appelle lui-même par Internet
const KEY_FILE = path.join(process.cwd(), 'cle-internet.txt');
const KEY = (() => {
  try { const k = fs.readFileSync(KEY_FILE, 'utf8').trim(); if (/^[a-z0-9]{10,40}$/.test(k)) return k; } catch (e) { /* pas encore de clé */ }
  // 12 caractères tirés parmi 32 : 60 bits, impossibles à deviner en essayant
  const A = 'abcdefghjkmnpqrstuvwxyz23456789'; const b = crypto.randomBytes(12); let k = '';
  for (const x of b) k += A[x % A.length];
  try { fs.writeFileSync(KEY_FILE, k + '\n'); } catch (e) { /* dossier en lecture seule : clé valable pour ce lancement */ }
  return k;
})();
const cookieOf = (req, name) => { const m = new RegExp('(?:^|;\\s*)' + name + '=([^;]*)').exec(String(req.headers.cookie || '')); return m ? decodeURIComponent(m[1]) : null; };
const sameKey = (k) => typeof k === 'string' && k.length === KEY.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(KEY));
// d'où vient la requête : du réseau local (accès libre, comme avant), ou d'Internet (clé exigée).
// ext : requête arrivée par le tunnel (elle vient de cloudflared, sur cet ordinateur, mais d'Internet)
const fromInternet = (req, ext) => ext || !isPrivateAddr(req.socket.remoteAddress);
const keyOf = (req, url) => url.searchParams.get('cle') || cookieOf(req, 'tiee_cle');
const allowed = (req, url, ext) => !fromInternet(req, ext) || sameKey(keyOf(req, url));
// commandes réservées à l'hôte : sur cet ordinateur, par son adresse locale (pas par le tunnel, pas
// par un nom de domaine qui pointerait ici)
const hostOnly = (req, ext) => !ext && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(String(req.headers.host || ''));
const NO_KEY_PAGE = Buffer.from(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TIEE Simulator</title></head>
<body style="font:16px/1.5 system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:0 16px;color:#222">
<h1 style="font-size:22px">Lien incomplet</h1>
<p>Cette partie de TIEE Simulator se rejoint avec le lien complet donné par l'hôte : il se termine par <code>?cle=</code> suivi de douze caractères.</p>
<p>Demandez-lui de vous le renvoyer (bouton « Copier » du salon, « Inviter par Internet »).</p></body></html>`, 'utf8');

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
    this.s = socket; this.buf = Buffer.alloc(0); this.frags = []; this.fragBytes = 0; this.alive = true; this.room = null; this.peer = null; this.addr = '';
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
        // les fragments d'un même message comptent ensemble : au-delà de MAX_MSG, la connexion est fermée
        this.fragBytes += payload.length;
        if (this.fragBytes > MAX_MSG) { this.close(1009); return; }
        this.frags.push(payload);
        if (!fin) continue;
        const msg = Buffer.concat(this.frags).toString('utf8'); this.frags = []; this.fragBytes = 0;
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
  onClose() { if (this.closed) return; this.closed = true; this.frags = []; this.buf = Buffer.alloc(0); CONNS.delete(this); leave(this); }
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
    if (!ROOMS.has(code) && ROOMS.size >= MAX_ROOMS) { c.send({ t: 'error', code: 'rooms', message: 'Trop de parties ouvertes sur ce serveur.' }); return; }
    const room = roomOf(code);
    if (room.peers.size >= MAX_PEERS) { c.send({ t: 'error', code: 'full', message: 'Partie complète.' }); return; }
    const presence = m.presence && typeof m.presence === 'object' && !Array.isArray(m.presence) && !tooBig(m.presence) ? m.presence : {};
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
  if (m.t === 'pres' && m.patch && typeof m.patch === 'object' && !Array.isArray(m.patch)) {
    const pr = c.peer.presence;
    const patch = {};
    for (const k of Object.keys(m.patch).slice(0, MAX_PRES_KEYS)) if (!BAD_KEY.has(k) && k.length <= 40) patch[k] = m.patch[k];
    const next = { ...pr }; for (const k of Object.keys(patch)) { if (patch[k] === null) delete next[k]; else next[k] = patch[k]; }
    if (Object.keys(next).length > MAX_PRES_KEYS || tooBig(next)) { c.send({ t: 'error', code: 'presence', message: 'Présence trop grosse : ignorée.' }); return; }
    for (const k of Object.keys(pr)) delete pr[k];
    Object.assign(pr, next);
    m.patch = patch;
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
const BAD_KEY = new Set(['__proto__', 'constructor', 'prototype']);
function clean(o) { const r = {}; for (const k of Object.keys(o).slice(0, MAX_PRES_KEYS)) if (o[k] !== null && !BAD_KEY.has(k) && k.length <= 40) r[k] = o[k]; return r; }
const tooBig = (o) => { try { return JSON.stringify(o).length > MAX_PRES; } catch (e) { return true; } };
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
const isLoopback = (a) => a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
// une requête d'un navigateur porte son origine : elle doit être cette page (même hôte). Sans en-tête
// Origin (outil en ligne de commande, tests), rien à vérifier : ce n'est pas une autre page qui agit.
function sameOrigin(req) {
  const o = req.headers.origin; if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}
const SENT = new Map(); // adresse -> envois de comptes rendus de la dernière minute
function allowRapport(addr) {
  const now = Date.now(), list = (SENT.get(addr) || []).filter((t) => now - t < 60000);
  if (list.length >= RAPPORT_PAR_MIN) { SENT.set(addr, list); return false; }
  list.push(now); SENT.set(addr, list); return true;
}
function countRapports() { try { return fs.readdirSync(RAPPORTS).filter((f) => f.endsWith('.json')).length; } catch (e) { return 0; } }
const onRequest = (ext) => async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const json = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
  try {
    // ce serveur répond-il à cette adresse ? (essai du lien direct par l'hôte lui-même)
    if (req.method === 'GET' && url.pathname === '/api/ping') { json(200, { ok: true, id: INSTANCE }); return; }
    if (url.pathname.startsWith('/api/internet')) { await internetApi(req, url, ext, json); return; }
    if (!allowed(req, url, ext)) {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) { res.writeHead(403, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(NO_KEY_PAGE); return; }
      json(403, { ok: false, message: 'Clé de la partie absente ou fausse.' }); return;
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      // venu d'Internet avec la clé : elle est gardée dans un cookie (rechargement, WebSocket)
      const cookie = fromInternet(req, ext) ? { 'set-cookie': `tiee_cle=${KEY}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax` } : {};
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', ...cookie, ...(gz ? { 'content-encoding': 'gzip' } : {}) });
      res.end(gz ? htmlGz : htmlBuf); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/parties') { json(200, { parties: partyList(), server: serverName() }); return; }
    if (req.method === 'POST' && url.pathname === '/api/rapport') {
      // seulement la page servie ici (une autre page web ouverte sur le réseau ne peut pas écrire sur le disque de l'hôte)
      if (!sameOrigin(req)) { json(403, { ok: false, message: 'Origine refusée.' }); return; }
      if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) { json(415, { ok: false, message: 'JSON attendu.' }); return; }
      if (!allowRapport(req.socket.remoteAddress || '')) { json(429, { ok: false, message: 'Trop de comptes rendus envoyés : réessayez dans une minute.' }); return; }
      if (countRapports() >= RAPPORTS_MAX) { json(507, { ok: false, message: `Le dossier « rapports » est plein (${RAPPORTS_MAX} comptes rendus) : faites-y de la place.` }); return; }
      const body = JSON.parse(await readBody(req, RAPPORT_MAX));
      if (!body || typeof body !== 'object') { json(400, { ok: false, message: 'Compte rendu illisible.' }); return; }
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
};
const onUpgrade = (ext) => (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  const url = new URL(req.url, 'http://local');
  if (url.pathname !== '/ws' || !key || String(req.headers.upgrade).toLowerCase() !== 'websocket') { socket.destroy(); return; }
  // une autre page web ne se branche pas sur les parties ; venu d'Internet sans la clé, non plus ;
  // trop de connexions (en tout, ou d'une même adresse) : refusé
  const addr = /** @type {import('node:net').Socket} */ (socket).remoteAddress || '';
  const fromAddr = [...CONNS].filter((c) => c.addr === addr).length;
  const ok = sameOrigin(req) && allowed(req, url, ext);
  if (!ok || CONNS.size >= MAX_CONNS || (!isLoopback(addr) && fromAddr >= MAX_CONNS_IP)) {
    socket.end(`HTTP/1.1 ${ok ? '503 Service Unavailable' : '403 Forbidden'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    return;
  }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  /** @type {import('node:net').Socket} */ (socket).setNoDelay(true);
  const conn = new Conn(socket); conn.addr = addr;
  CONNS.add(conn);
};
const server = http.createServer(onRequest(false));
server.on('upgrade', onUpgrade(false));

// ---------------- par Internet ----------------
// porte du tunnel : un second serveur, sur cet ordinateur seulement, où tout ce qui arrive vient d'Internet
let tunnelServer = null;
const tunnelPort = () => new Promise((res, rej) => {
  if (tunnelServer) { res(/** @type {import('node:net').AddressInfo} */ (tunnelServer.address()).port); return; }
  const s = http.createServer(onRequest(true)); s.on('upgrade', onUpgrade(true));
  s.once('error', rej);
  s.listen(0, '127.0.0.1', () => { tunnelServer = s; res(/** @type {import('node:net').AddressInfo} */ (s.address()).port); });
});
let INTERNET = null; // créé une fois le port connu
async function internetApi(req, url, ext, json) {
  if (!hostOnly(req, ext)) { json(403, { ok: false, message: 'Réservé à l\'ordinateur de l\'hôte.' }); return; }
  if (req.method === 'GET' && url.pathname === '/api/internet') { json(200, INTERNET.status()); return; }
  if (req.method !== 'POST' || !sameOrigin(req)) { json(405, { ok: false }); return; }
  const act = url.pathname.slice('/api/internet/'.length);
  if (act === 'direct') INTERNET.openDirect().catch((e) => console.error(e));
  else if (act === 'tunnel') INTERNET.openTunnel().catch((e) => console.error(e));
  else if (act === 'fermer') await INTERNET.close();
  else { json(404, { ok: false }); return; }
  json(200, INTERNET.status());
}
// à l'arrêt (Ctrl+C, fenêtre fermée sous Windows : SIGHUP), on referme la box et le tunnel
let stopping = false;
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => {
  if (stopping) process.exit(0);
  stopping = true;
  const done = () => process.exit(0);
  if (!INTERNET) done(); else { INTERNET.close().then(done, done); setTimeout(done, 3000).unref(); }
});
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
  console.log('  Pour jouer avec quelqu\'un qui est chez lui : dans le simulateur, Jouer > Coopération >');
  console.log('  Ouvrir le salon > « Inviter par Internet ». Le lien à lui envoyer s\'affiche ici et dans le salon.\n');
  INTERNET = createInternet({ port: PORT, tunnelPort, key: KEY, id: INSTANCE, log: (t) => console.log(`${hhmm()}${t}`) });
  if (NET_AT_START) INTERNET.openDirect();
  if (OPEN) openBrowser(`http://localhost:${PORT}`);
});
