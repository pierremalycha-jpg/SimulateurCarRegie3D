// @ts-check
// ----------------------------------------------------------------------------------
// TIEE Simulator — jouer par Internet (utilisé par lan/serveur.mjs, aucune dépendance)
//
// Chez soi, l'ordinateur qui héberge est derrière la box : depuis Internet, on ne voit que
// l'adresse publique de la box, qui ne sait pas à quel ordinateur passer les connexions. Deux
// façons d'y arriver, essayées dans cet ordre :
//
// 1. Ouvrir la box (lien direct). Le serveur demande lui-même à la box une redirection de port
//    (UPnP IGD : découverte SSDP en multicast 239.255.255.250:1900, puis commandes SOAP
//    AddPortMapping / GetExternalIPAddress). Il lit l'adresse publique de la box et la compare à
//    celle que voit Internet (api.ipify.org) : si elles diffèrent, ou si la box n'a qu'une adresse
//    privée ou partagée (CGNAT, 100.64.0.0/10), un lien direct ne peut pas marcher.
//    La redirection a une durée (1 h, renouvelée toutes les 20 min) : si le serveur s'arrête
//    brutalement, la box la retire d'elle-même.
// 2. Un tunnel (Cloudflare « quick tunnel », gratuit, sans compte) : le programme cloudflared,
//    téléchargé une seule fois depuis la page officielle du projet sur GitHub, ouvre une
//    connexion sortante vers Cloudflare, qui donne une adresse https://….trycloudflare.com.
//    Rien à régler sur la box ni sur le pare-feu.
//
// Dans les deux cas, le lien porte une clé (?cle=…) : sans elle, une connexion venue d'Internet
// est refusée (lan/serveur.mjs).
// ----------------------------------------------------------------------------------
import dgram from 'node:dgram';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';

// ---------------- adresses ----------------
const v4 = (a) => String(a || '').replace(/^::ffff:/i, '');
const octets = (a) => { const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(v4(a)); return m ? m.slice(1).map(Number) : null; };
/** adresse de CGNAT (100.64.0.0/10) : l'opérateur partage une adresse publique entre plusieurs abonnés */
export const isCgnat = (a) => { const o = octets(a); return !!o && o[0] === 100 && o[1] >= 64 && o[1] <= 127; };
/** adresse qui ne vient pas d'Internet : cet ordinateur, réseau privé (RFC 1918), lien local, IPv6 locale (ULA) */
export function isPrivateAddr(a) {
  const s = String(a || '').toLowerCase();
  if (s === '::1' || s === 'localhost') return true;
  const o = octets(s);
  if (o) return o[0] === 127 || o[0] === 10 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 192 && o[1] === 168) || (o[0] === 169 && o[1] === 254);
  return /^fe[89ab][0-9a-f]:/.test(s) || /^f[cd][0-9a-f]{2}:/.test(s);
}
/** adresse publique IPv4 (ni privée, ni partagée, ni réservée) */
export const isPublicV4 = (a) => { const o = octets(a); return !!o && !isPrivateAddr(a) && !isCgnat(a) && o[0] !== 0 && o[0] < 224; };

/** cartes réseau de cet ordinateur (IPv4, hors boucle locale) */
export function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address, netmask: a.netmask });
  return out;
}
/** la carte de cet ordinateur qui est sur le même réseau que la box */
export function sameSubnet(local, other) {
  const a = octets(local.address), b = octets(other), m = octets(local.netmask || '255.255.255.0');
  return !!a && !!b && !!m && a.every((x, i) => (x & m[i]) === (b[i] & m[i]));
}

// ---------------- petites requêtes HTTP (la box parle HTTP simple, sur le réseau local) ----------------
/** @returns {Promise<{ status: number, body: string }>} */
function httpRequest(url, { method = 'GET', headers = {}, body = '', timeout = 3000, limit = 512 * 1024 } = {}) {
  return new Promise((res, rej) => {
    const req = http.request(url, { method, headers: { ...headers, ...(body ? { 'content-length': Buffer.byteLength(body) } : {}) }, timeout }, (r) => {
      const chunks = []; let n = 0;
      r.on('data', (d) => { n += d.length; if (n > limit) { req.destroy(new Error('réponse trop longue')); } else chunks.push(d); });
      r.on('end', () => res({ status: r.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
      r.on('error', rej);
    });
    req.on('timeout', () => req.destroy(new Error('pas de réponse')));
    req.on('error', rej);
    req.end(body || undefined);
  });
}

// ---------------- UPnP IGD : découverte de la box ----------------
const SSDP = { host: '239.255.255.250', port: 1900 };
const SEARCH = ['urn:schemas-upnp-org:device:InternetGatewayDevice:1', 'urn:schemas-upnp-org:device:InternetGatewayDevice:2', 'urn:schemas-upnp-org:service:WANIPConnection:1'];
/** en-têtes d'une réponse SSDP (HTTP sur UDP), noms en minuscules */
export function parseSsdp(text) {
  const h = {};
  for (const line of String(text).split(/\r?\n/).slice(1)) { const i = line.indexOf(':'); if (i > 0) h[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim(); }
  return h;
}
/**
 * Cherche les box (passerelles UPnP) sur chaque carte réseau.
 * @returns {Promise<{ location: string, local: string }[]>} adresse de la description, carte qui a reçu la réponse
 */
export function discoverGateways({ timeout = 2500, addrs = lanAddresses().map((a) => a.address), to = SSDP } = {}) {
  return new Promise((resolve) => {
    const found = new Map(); const socks = [];
    const done = () => { for (const s of socks) { try { s.close(); } catch (e) { /* déjà fermée */ } } resolve([...found.values()]); };
    for (const local of addrs) {
      const s = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      socks.push(s);
      s.on('error', () => { /* carte sans multicast : on passe */ });
      s.on('message', (msg) => {
        const h = parseSsdp(msg.toString('utf8'));
        if (h.location && /^http:\/\//i.test(h.location) && !found.has(h.location)) found.set(h.location, { location: h.location, local });
      });
      s.bind(0, local, () => {
        // deux envois : un paquet UDP peut se perdre
        for (const st of SEARCH) for (let k = 0; k < 2; k++) {
          const m = Buffer.from(`M-SEARCH * HTTP/1.1\r\nHOST: ${SSDP.host}:${SSDP.port}\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ${st}\r\n\r\n`);
          setTimeout(() => { try { s.send(m, to.port, to.host, () => { /* erreur d'envoi ignorée */ }); } catch (e) { /* recherche déjà finie */ } }, k * 300);
        }
      });
    }
    setTimeout(done, timeout).unref?.();
  });
}

const tag = (xml, name) => { const m = new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i').exec(xml); return m ? m[1].trim() : ''; };
const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'').replace(/&amp;/g, '&');
const exml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/**
 * Description de la box : son nom et ses services de connexion à Internet, du meilleur au moins bon
 * (WANIPConnection:2, :1, puis WANPPPConnection:1).
 */
export function parseGateway(xml, location) {
  const base = tag(xml, 'URLBase') || location;
  const services = [];
  for (const m of String(xml).matchAll(/<(?:\w+:)?service>([\s\S]*?)<\/(?:\w+:)?service>/gi)) {
    const type = tag(m[1], 'serviceType'), ctl = tag(m[1], 'controlURL');
    if (!/:service:WAN(IP|PPP)Connection:\d/i.test(type) || !ctl) continue;
    let control; try { control = new URL(unxml(ctl), base).href; } catch (e) { continue; }
    services.push({ type, control });
  }
  const rank = (t) => (/WANIPConnection:2/i.test(t) ? 0 : /WANIPConnection/i.test(t) ? 1 : 2);
  services.sort((a, b) => rank(a.type) - rank(b.type));
  return { name: unxml(tag(xml, 'friendlyName')), model: unxml([tag(xml, 'manufacturer'), tag(xml, 'modelName')].filter(Boolean).join(' ')), services };
}

// ---------------- UPnP IGD : commandes SOAP ----------------
export function soapEnvelope(service, action, args = {}) {
  const inner = Object.entries(args).map(([k, v]) => `<${k}>${exml(v)}</${k}>`).join('');
  return `<?xml version="1.0"?>\r\n<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${action} xmlns:u="${service}">${inner}</u:${action}></s:Body></s:Envelope>`;
}
/** réponse SOAP : valeurs rendues, ou code d'erreur UPnP (718 : déjà redirigé ailleurs, 725 : durée refusée…) */
export function parseSoap(status, xml) {
  if (status >= 200 && status < 300) {
    const values = {};
    for (const m of String(xml).matchAll(/<(New\w+)>([\s\S]*?)<\/\1>/g)) values[m[1]] = unxml(m[2].trim());
    return { ok: true, values };
  }
  const code = +tag(xml, 'errorCode') || 0;
  return { ok: false, code, message: unxml(tag(xml, 'errorDescription')) || `HTTP ${status}` };
}
async function soap(svc, action, args) {
  try {
    const r = await httpRequest(svc.control, { method: 'POST', body: soapEnvelope(svc.type, action, args), headers: { 'content-type': 'text/xml; charset="utf-8"', soapaction: `"${svc.type}#${action}"` }, timeout: 4000 });
    return parseSoap(r.status, r.body);
  } catch (e) { return { ok: false, code: 0, message: e.message }; }
}
const UPNP_WHY = {
  606: 'la box refuse que les programmes ouvrent ses ports (UPnP en lecture seule)', 401: 'la box refuse cette commande',
  718: 'ce port est déjà redirigé vers un autre appareil', 724: 'la box veut le même port des deux côtés', 725: 'la box n\'accepte que des redirections permanentes',
  727: 'la box n\'accepte pas ce port', 728: 'la table de redirections de la box est pleine', 729: 'la box refuse ce port',
};
const why = (r) => UPNP_WHY[r.code] || r.message || 'erreur ' + r.code;

/**
 * Ouvre le port sur la box. Essaie chaque box trouvée, chaque service, puis quelques ports
 * extérieurs si le premier est déjà pris.
 * @param {{ port: number, desc?: string, lease?: number, gateways?: { location: string, local: string }[] | null }} o
 * @returns {Promise<{ ok: boolean, why?: string, box?: string, wanIp?: string, extPort?: number, local?: string, port?: number, desc?: string, svc?: any, lease?: number }>}
 */
export async function upnpOpen({ port, desc = 'TIEE Simulator', lease = 3600, gateways = null }) {
  const gws = gateways || await discoverGateways();
  if (!gws.length) return { ok: false, why: 'aucune box UPnP n\'a répondu (UPnP désactivé sur la box, ou réseau qui le bloque)' };
  let last = 'la box n\'a pas accepté la redirection', tried = false;
  for (const gw of gws) {
    let desc0;
    try { const r = await httpRequest(gw.location, { timeout: 3000 }); desc0 = parseGateway(r.body, gw.location); } catch (e) { last = 'description de la box illisible (' + e.message + ')'; continue; }
    const box = desc0.model || desc0.name || new URL(gw.location).hostname;
    for (const svc of desc0.services) {
      // service inutilisé (souvent WANPPPConnection sur une box fibre) : il ne donne pas d'adresse, on passe
      const ip = await soap(svc, 'GetExternalIPAddress', {});
      const wanIp = ip.ok ? ip.values.NewExternalIPAddress || '' : '';
      if (!wanIp) { if (!tried) last = 'la box n\'est pas connectée à Internet (pas d\'adresse extérieure)'; continue; }
      tried = true;
      let lz = lease;
      for (let ext = port; ext < port + 6; ext++) {
        const args = () => ({ NewRemoteHost: '', NewExternalPort: ext, NewProtocol: 'TCP', NewInternalPort: port, NewInternalClient: gw.local, NewEnabled: 1, NewPortMappingDescription: desc, NewLeaseDuration: lz });
        let r = await soap(svc, 'AddPortMapping', args());
        if (!r.ok && r.code === 725) { lz = 0; r = await soap(svc, 'AddPortMapping', args()); }
        if (!r.ok && r.code === 718) {
          // déjà redirigé : vers nous (lancement précédent) c'est bon, vers un autre appareil on essaie le port suivant
          const cur = await soap(svc, 'GetSpecificPortMappingEntry', { NewRemoteHost: '', NewExternalPort: ext, NewProtocol: 'TCP' });
          if (cur.ok && cur.values.NewInternalClient === gw.local && +cur.values.NewInternalPort === port) r = { ok: true, values: {} };
          else { last = why(r); continue; }
        }
        if (r.ok) return { ok: true, box, wanIp, extPort: ext, local: gw.local, port, desc, svc, lease: lz };
        last = why(r);
        if (r.code !== 718 && r.code !== 727 && r.code !== 729) break; // refus qui ne dépend pas du port : inutile d'en essayer d'autres
      }
    }
  }
  return { ok: false, why: last };
}
/** renouvelle la même redirection avant la fin de sa durée */
export async function upnpRenew(m) {
  const r = await soap(m.svc, 'AddPortMapping', { NewRemoteHost: '', NewExternalPort: m.extPort, NewProtocol: 'TCP', NewInternalPort: m.port, NewInternalClient: m.local, NewEnabled: 1, NewPortMappingDescription: m.desc, NewLeaseDuration: m.lease });
  return r.ok;
}
export async function upnpClose(m) {
  if (!m || !m.svc) return;
  await soap(m.svc, 'DeletePortMapping', { NewRemoteHost: '', NewExternalPort: m.extPort, NewProtocol: 'TCP' });
}

// ---------------- adresse publique vue d'Internet ----------------
export async function publicIp({ timeout = 4000 } = {}) {
  try {
    const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(timeout) });
    const j = await r.json();
    return octets(j.ip) ? String(j.ip) : null;
  } catch (e) { return null; }
}

// ---------------- Windows : réseau « public » (le pare-feu y bloque les connexions entrantes) ----------------
function windowsProfile() {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return new Promise((res) => {
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', '(Get-NetConnectionProfile | Select-Object -ExpandProperty NetworkCategory) -join ","'], { timeout: 6000, windowsHide: true }, (err, out) => res(err ? null : String(out).trim()));
  });
}

// ---------------- tunnel Cloudflare ----------------
const CF_ASSET = { 'win32-x64': 'cloudflared-windows-amd64.exe', 'win32-ia32': 'cloudflared-windows-386.exe', 'win32-arm64': 'cloudflared-windows-amd64.exe', 'linux-x64': 'cloudflared-linux-amd64', 'linux-arm64': 'cloudflared-linux-arm64', 'linux-arm': 'cloudflared-linux-arm', 'darwin-x64': 'cloudflared-darwin-amd64.tgz', 'darwin-arm64': 'cloudflared-darwin-arm64.tgz' };
const CF_URL = (a) => `https://github.com/cloudflare/cloudflared/releases/latest/download/${a}`;
export function cacheDir() {
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'TIEE-Simulator');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', 'TIEE-Simulator');
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'tiee-simulator');
}
/** l'adresse du tunnel dans le journal de cloudflared */
export const tunnelUrlIn = (text) => { const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.exec(String(text)); return m ? m[0] : null; };
const runOk = (file, args) => new Promise((res) => execFile(file, args, { timeout: 15000, windowsHide: true }, (err, out) => res(err ? null : String(out))));

/** cloudflared prêt à lancer (téléchargé une seule fois) ; onPct(0…100) pendant le téléchargement */
async function cloudflared(onPct) {
  if (process.env.TIEE_CLOUDFLARED) return process.env.TIEE_CLOUDFLARED; // tests, ou programme déjà installé ailleurs
  const asset = CF_ASSET[`${process.platform}-${process.arch}`];
  if (!asset) throw new Error(`tunnel indisponible sur ce système (${process.platform} ${process.arch})`);
  const dir = cacheDir(); fs.mkdirSync(dir, { recursive: true });
  const bin = path.join(dir, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  if (fs.existsSync(bin) && await runOk(bin, ['--version'])) return bin;
  const r = await fetch(CF_URL(asset), { redirect: 'follow', signal: AbortSignal.timeout(10 * 60000) });
  if (!r.ok || !r.body) throw new Error(`téléchargement de cloudflared : HTTP ${r.status}`);
  const total = +(r.headers.get('content-length') || 0); let got = 0;
  const tmp = bin + '.part';
  const out = fs.createWriteStream(tmp);
  try {
    for await (const chunk of /** @type {any} */ (r.body)) { got += chunk.length; if (!out.write(chunk)) await new Promise((ok) => out.once('drain', () => ok(null))); if (total) onPct(Math.round(got * 100 / total)); }
  } finally { await new Promise((ok) => out.end(() => ok(null))); }
  if (asset.endsWith('.tgz')) {
    await new Promise((ok, ko) => execFile('tar', ['-xzf', tmp, '-C', dir], (e) => (e ? ko(e) : ok(null))));
    fs.rmSync(tmp, { force: true });
  } else fs.renameSync(tmp, bin);
  fs.chmodSync(bin, 0o755);
  if (!await runOk(bin, ['--version'])) throw new Error('cloudflared téléchargé mais impossible à lancer');
  return bin;
}

// ---------------- l'ensemble : état lisible par la page de l'hôte ----------------
/**
 * @param {{ port: number, tunnelPort: () => Promise<number>, key: string, id: string, log?: (s: string) => void }} o
 */
export function createInternet(o) {
  const log = o.log || (() => {});
  const st = {
    analyse: /** @type {null | { cartes: any[], profil: string | null }} */ (null),
    direct: /** @type {any} */ ({ etat: 'non' }), // non | recherche | ouvert | echec
    tunnel: /** @type {any} */ ({ etat: 'non' }), // non | telechargement | demarrage | pret | echec
  };
  let mapping = null, renew = null, proc = null;
  const withKey = (base) => `${base.replace(/\/$/, '')}/?cle=${o.key}`;

  // le lien direct répond-il vraiment ? (essai depuis cet ordinateur vers l'adresse publique : beaucoup
  // de box le permettent, d'autres non ; un échec ne prouve donc pas que le lien ne marche pas)
  async function selfCheck(url) {
    try { const r = await fetch(url + '/api/ping', { signal: AbortSignal.timeout(4000) }); const j = await r.json(); return j && j.id === o.id; } catch (e) { return false; }
  }

  async function openDirect() {
    if (st.direct.etat === 'recherche') return;
    st.direct = { etat: 'recherche' };
    const cartes = lanAddresses();
    st.analyse = { cartes, profil: null };
    windowsProfile().then((p) => { if (st.analyse) st.analyse.profil = p; });
    if (!cartes.length) { st.direct = { etat: 'echec', why: 'aucune carte réseau branchée' }; return; }
    const [m, pub] = await Promise.all([upnpOpen({ port: o.port }), publicIp()]);
    if (!m.ok) { st.direct = { etat: 'echec', why: m.why, publique: pub }; log(`  Par Internet : la box n'a pas été ouverte (${m.why}).`); return; }
    if (mapping && (mapping.extPort !== m.extPort || mapping.local !== m.local)) upnpClose(mapping);
    mapping = m;
    clearInterval(renew); renew = m.lease ? setInterval(() => { if (mapping) upnpRenew(mapping); }, 20 * 60000) : null;
    if (renew) renew.unref();
    const wan = m.wanIp;
    // la box n'a pas d'adresse publique à elle : opérateur qui partage les adresses (CGNAT) ou deux box en cascade
    const partagee = !isPublicV4(wan) || (pub && pub !== wan);
    const ip = isPublicV4(wan) ? wan : pub;
    const base = ip ? `http://${ip}:${m.extPort}` : null;
    st.direct = { etat: 'ouvert', box: m.box, local: m.local, port: o.port, extPort: m.extPort, wan, publique: pub, partagee: !!partagee, lien: base && !partagee ? withKey(base) : null, verifie: null };
    log(`  Box ${m.box} : port ${m.extPort} ouvert vers ${m.local}:${o.port}${partagee ? ` (attention : adresse de la box ${wan || '?'}, adresse vue d'Internet ${pub || '?'} : adresse partagée, le lien direct ne marchera pas)` : ''}.`);
    if (base && !partagee) {
      const ok = await selfCheck(base);
      if (st.direct.etat === 'ouvert') st.direct.verifie = ok;
      log(`  Lien direct : ${withKey(base)}${ok ? '  (vérifié)' : ''}`);
    }
  }

  async function openTunnel() {
    if (['telechargement', 'demarrage', 'pret'].includes(st.tunnel.etat)) return;
    st.tunnel = { etat: 'telechargement', pct: 0 };
    let bin;
    try { bin = await cloudflared((p) => { st.tunnel.pct = p; }); } catch (e) { st.tunnel = { etat: 'echec', why: e.message }; return; }
    st.tunnel = { etat: 'demarrage' };
    const port = await o.tunnelPort();
    const p = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    proc = p;
    let journal = '';
    const read = (d) => {
      journal = (journal + d).slice(-8000);
      const url = st.tunnel.etat === 'demarrage' && tunnelUrlIn(journal);
      if (url) { st.tunnel = { etat: 'pret', url, lien: withKey(url) }; log(`  Lien par tunnel : ${withKey(url)}`); }
    };
    p.stdout.on('data', read); p.stderr.on('data', read);
    p.on('error', (e) => { if (proc === p) st.tunnel = { etat: 'echec', why: e.message }; });
    p.on('exit', (code) => {
      if (proc !== p) return;
      proc = null;
      const last = journal.trim().split('\n').slice(-2).join(' ').slice(0, 300);
      st.tunnel = { etat: 'echec', why: `le tunnel s'est arrêté (code ${code})${last ? ' : ' + last : ''}` };
    });
    setTimeout(() => { if (proc === p && st.tunnel.etat === 'demarrage') { st.tunnel = { etat: 'echec', why: 'Cloudflare n\'a pas donné d\'adresse en 40 s (connexion Internet, ou pare-feu qui bloque les connexions sortantes)' }; proc = null; p.kill(); } }, 40000).unref();
  }

  async function close() {
    clearInterval(renew); renew = null;
    if (proc) { const p = proc; proc = null; p.kill(); }
    if (mapping) { const m = mapping; mapping = null; await upnpClose(m); }
    st.direct = { etat: 'non' }; st.tunnel = { etat: 'non' };
  }
  const status = () => {
    // le lien à donner : direct vérifié, sinon le tunnel, sinon le direct non vérifié
    const lien = (st.direct.verifie === true && st.direct.lien) || (st.tunnel.etat === 'pret' && st.tunnel.lien) || st.direct.lien || null;
    return { cle: o.key, port: o.port, cartes: lanAddresses(), profil: st.analyse ? st.analyse.profil : null, direct: st.direct, tunnel: st.tunnel, lien };
  };
  return { openDirect, openTunnel, close, status, get mapping() { return mapping; } };
}
