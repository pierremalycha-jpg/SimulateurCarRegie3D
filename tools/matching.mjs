#!/usr/bin/env node
// @ts-check
// ----------------------------------------------------------------------------------
// Le matching à la mire (v19.30) : le serveur de la page dist/matching.html et le relais vers les caméras.
//
//   node tools/matching.mjs                 (port 8090, ou le suivant s'il est pris)
//   node tools/matching.mjs --port 9000     (port imposé)
//   node tools/matching.mjs --ouvrir        (ouvre aussi la page dans le navigateur)
//
// Pourquoi un serveur : la page lit les caméras et cartes d'acquisition (getUserMedia), ce qu'un navigateur
// n'accorde qu'à une page sur localhost ou en https ; et elle parle aux caméras Panasonic par HTTP, ce que
// la politique d'origine du navigateur interdit depuis une page : le relais (/relais?url=…) fait la requête
// à sa place. Il ne relaie que vers une adresse privée (192.168…, 10…, 172.16…, localhost) et vers un
// chemin /cgi-bin/ : rien d'autre ne sort. Aucune dépendance (Node.js 18 ou plus récent).
// ----------------------------------------------------------------------------------
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isPrivateAddr } from '../lan/internet.mjs';

const argPort = process.argv.indexOf('--port');
const ASKED = +(argPort > 0 ? process.argv[argPort + 1] : process.env.PORT) || 0;
let PORT = ASKED || 8090;
const OPEN = process.argv.includes('--ouvrir');
const DELAI_CAMERA = 6000; // une caméra qui ne répond pas en 6 s est absente

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER = path.join(ROOT, 'dist', 'matching.html');
if (!fs.existsSync(FICHIER)) { console.error(`Page introuvable : ${FICHIER}\nConstruisez-la d'abord : node tools/build.mjs`); process.exit(1); }
const PAGE = fs.readFileSync(FICHIER);

/** l'adresse demandée est-elle relayable : http, hôte privé, chemin /cgi-bin/ */
export function cibleAdmise(texte) {
  let u; try { u = new URL(String(texte || '')); } catch (e) { return null; }
  if (u.protocol !== 'http:') return null;
  if (!isPrivateAddr(u.hostname.replace(/^\[|\]$/g, ''))) return null;
  if (!u.pathname.startsWith('/cgi-bin/')) return null;
  return u;
}

async function relayer(cible, res) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), DELAI_CAMERA);
  try {
    const r = await fetch(cible, { signal: ctl.signal, headers: { 'User-Agent': 'AW-Cam Controller' } });
    const corps = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(corps);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`La caméra ${cible.host} ne répond pas (${e && e.name === 'AbortError' ? 'délai dépassé' : (e && e.message) || e}).`);
  } finally { clearTimeout(t); }
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url || '/', 'http://x');
  if (u.pathname === '/' || u.pathname === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(PAGE); }
  if (u.pathname === '/relais') {
    const cible = u.searchParams.get('url');
    if (!cible) { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('relais : il manque ?url='); }
    const ok = cibleAdmise(cible);
    if (!ok) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('relais : seulement http vers une adresse privée et un chemin /cgi-bin/'); }
    return void relayer(ok, res);
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Introuvable');
});

function openBrowser(url) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { const c = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true, windowsVerbatimArguments: true }); c.on('error', () => console.log(`  Ouvrez vous-même ${url}`)); c.unref(); } catch (e) { console.log(`  Ouvrez vous-même ${url}`); }
}
function ecouter() {
  server.once('error', (e) => {
    if (/** @type {any} */ (e).code === 'EADDRINUSE' && !ASKED && PORT < 8100) { PORT++; ecouter(); } else { console.error(`Impossible d'écouter sur le port ${PORT} : ${e.message}`); process.exit(1); }
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Matching à la mire : http://localhost:${PORT}  (la vidéo en direct et le relais vers les caméras ne marchent que sur cette adresse)`);
    if (OPEN) openBrowser(`http://localhost:${PORT}`);
  });
}
ecouter();
