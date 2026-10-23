// @ts-check
import { S, emit, on, camById } from '../state.js';
import { M } from '../match.js';
import { lerpAngle, clamp } from '../util.js';
import { SH } from '../shared.js';
import { SLICES, sliceKey } from './slices.js';
import { lanAvailable, lanRoom, browserId } from './lan.js';

// ----------------------------------------------------------------------------------
// Session à plusieurs, en temps réel : dans la page publiée (capacité « room » de claude.ai)
// ou sur un réseau local (lan/serveur.mjs, même interface : voir lan.js).
// · Chaque joueur a un pseudo et un rôle ; sa position (pour son avatar) est publiée dans sa
//   présence, avec le poste qu'il occupe ou la caméra qu'il cadre.
// · Un HÔTE fait tourner le match : il publie dans sa présence un instantané (≈ 12/s) des
//   joueurs, du ballon, de l'horloge et du cadre de chaque caméra. Les autres pages le
//   suivent avec 0,3 s de retard, en interpolant : tout le monde voit le même match.
// · Chaque rôle possède des « tranches » d'état (mélangeur, EVS, son…) : seul celui qui
//   tient le rôle les diffuse, les autres pages les appliquent ; une tranche sans titulaire
//   appartient à l'hôte. Les postes tenus par un autre s'ouvrent en lecture seule.
// · Événements : sons et faits de jeu (evt), commentaires (cmt), ordres et messages (ord),
//   demande de mise à jour d'un arrivant (hello) ; formateur seulement : forcer un état
//   pour injecter une panne (force) et annonces (ses).
// ----------------------------------------------------------------------------------
export const ROLES_S = {
  formateur: { label: 'Formateur', desc: 'Anime la session, injecte des pannes, suit tout le monde et récupère le compte rendu.', slices: [] },
  realisateur: { label: 'Réalisateur', desc: 'Donne les ordres (« Prépare la 3… Top ! ») au truquiste, demande ralentis et graphiques.', slices: [] },
  truquiste: { label: 'Truquiste', desc: 'Pilote le mélangeur : preset, cut, enchaînés, DSK, au rythme des ordres.', slices: ['mix'] },
  evs: { label: 'Opérateur ralentis', desc: 'Prépare et lit les ralentis sur l\'EVS (LSM, IPDirector).', slices: ['evs'] },
  son: { label: 'Ingénieur du son', desc: 'Tient la console : ambiances, canons, commentateurs, N-1, plan de son.', slices: ['audio'] },
  vision: { label: 'Ingénieur vision', desc: 'Règle les caméras au RCP : iris, noirs, blancs, couleur.', slices: ['cams'] },
  technique: { label: 'Technicien de car', desc: 'Grille, baie CCU, synchro, transmission, régie HF.', slices: ['router', 'tech', 'links'] },
  habillage: { label: 'Habilleur', desc: 'Envoie score, bandeaux et statistiques.', slices: ['gfx'] },
  cadreur: { label: 'Cadreur', desc: 'Prend une caméra (touche E devant la caméra) : son cadre est vu par tous.', slices: [] },
  observateur: { label: 'Observateur', desc: 'Regarde sans rien piloter.', slices: [] },
};
const DELAY = 0.3;            // retard de lecture des suiveurs (s)
const SNAP_HZ = 12;
export const SES = {
  room: null, named: null, code: '', active: false, connected: false, role: 'observateur', since: 0, transport: '', hosting: false,
  me: null, host: null, hostPeer: null, peers: [], owners: {}, names: {}, cfg: null,
  buf: [], rt: null, evq: [], sentKeys: {}, presSent: {}, lastPres: {}, log: [], chat: [], orders: [], unsub: [],
  follower: false, report: null, known: new Map(),
};
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const TAU = Math.PI * 2;

// ---------------- connexion ----------------
let roomP = null;
export function getRoom() {
  if (!roomP) roomP = (async () => {
    // page servie par le serveur réseau local : on joue sur le réseau de la salle
    if (lanAvailable()) return lanRoom();
    try { const c = window.claude; if (!c || typeof c.use !== 'function') return null; return await Promise.race([c.use('room'), new Promise((r) => setTimeout(() => r(null), 11000))]); } catch (e) { return null; }
  })();
  return roomP;
}
export const transportKind = () => (lanAvailable() ? 'lan' : 'room');
// pseudo du joueur (mémorisé dans ce navigateur)
export function getPseudo() { try { return localStorage.getItem('carregie.pseudo') || ''; } catch (e) { return ''; } }
export function setPseudo(v) {
  const n = String(v || '').replace(/\s+/g, ' ').trim().slice(0, 24);
  try { localStorage.setItem('carregie.pseudo', n); } catch (e) { /* stockage indisponible */ }
  if (SES.active && n) { pres({ name: n }); emit('session', { type: 'names' }); }
  return n;
}
export const randomCode = () => Math.random().toString(36).slice(2, 6).toLowerCase();

export async function joinSession(code, role, opts = {}) {
  const room = await getRoom();
  if (!room) return { ok: false, why: 'room' };
  code = String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || randomCode();
  let named;
  try { named = await room.join('car-' + code); } catch (e) { return { ok: false, why: e && e.code || 'join' }; }
  SES.known = new Map();
  Object.assign(SES, { room, named, code, active: true, role: ROLES_S[role] ? role : 'observateur', since: Date.now(), cam: opts.cam || null, buf: [], rt: null, evq: [], sentKeys: {}, presSent: {}, lastPres: {}, log: [], chat: [], orders: [], follower: false, cfg: opts.cfg || null, transport: room.kind === 'lan' ? 'lan' : 'room', hosting: !!opts.host });
  SES.report = { code, startedAt: Date.now(), orders: [], faults: [], chat: [], roles: {} };
  const ps = named.presence({ uid: SH.uid || null, bid: browserId(), name: getPseudo() || 'Stagiaire', host: !!opts.host || null, role: SES.role, since: SES.since, cam: SES.cam, cfg: opts.cfg || null });
  if (ps && ps.catch) ps.catch(() => {});
  SES.unsub.push(named.onPeers((ch) => onPeers(ch), () => {}));
  SES.unsub.push(named.onConnection((c) => { SES.connected = c; emit('session', { type: 'conn' }); }, () => {}));
  for (const t of ['sx', 'force', 'evt', 'cmt', 'ord', 'hello', 'ses']) SES.unsub.push(named.on(t, (m) => onMsg(t, m), () => {}));
  send('hello', { role: SES.role });
  log(`Vous rejoignez la session ${code} comme ${ROLES_S[SES.role].label}.`);
  emit('session', { type: 'join' });
  return { ok: true, code };
}
export async function leaveSession() {
  if (!SES.active) return;
  for (const u of SES.unsub) { try { u(); } catch (e) { /* rien */ } }
  SES.unsub = [];
  try { await SES.named.leave(); } catch (e) { /* rien */ }
  for (const c of S.cams) c.remotePose = false;
  S.sessionFollower = false;
  Object.assign(SES, { active: false, named: null, follower: false, host: null, hostPeer: null, peers: [], owners: {}, hosting: false });
  emit('session', { type: 'leave' });
}
export function setRole(role, cam) {
  if (!SES.active || !ROLES_S[role]) return;
  SES.role = role; SES.since = Date.now(); SES.cam = cam || null;
  pres({ role, since: SES.since, cam: SES.cam });
  log(`Vous prenez le rôle ${ROLES_S[role].label}.`);
  emit('session', { type: 'role' });
}
function send(topic, data) { if (!SES.named) return; const p = SES.named.emit(topic, data); if (p && p.catch) p.catch((e) => { if (e && e.code === 'not_permitted') log(`Envoi refusé (${topic}) : droits insuffisants sur la page.`); }); }
function pres(patch) { if (!SES.named) return; const p = SES.named.presence(patch); if (p && p.catch) p.catch(() => {}); }
function log(text, kind = '') { SES.log.push({ at: Date.now(), text, kind }); if (SES.log.length > 80) SES.log.shift(); emit('session', { type: 'log' }); }
export const sessionLog = (text, kind) => log(text, kind);

// ---------------- participants, hôte, titulaires des rôles ----------------
function onPeers(ch) {
  SES.peers = ch.peers.slice();
  SES.me = SES.peers.find((p) => p.sameTab) || SES.me;
  electHost();
  // titulaire de chaque tranche : le plus ancien qui tient le rôle ; sinon l'hôte
  const owners = {};
  for (const id in SLICES) {
    const role = SLICES[id].role;
    const holders = SES.peers.filter((p) => p.presence && p.presence.role && ROLES_S[p.presence.role] && ROLES_S[p.presence.role].slices.includes(id)).sort((a, b) => (a.presence.since || 0) - (b.presence.since || 0));
    owners[id] = (holders[0] || SES.hostPeer || {}).peer || null;
    if (role === '_host') owners[id] = SES.hostPeer ? SES.hostPeer.peer : null;
  }
  const changed = JSON.stringify(owners) !== JSON.stringify(SES.owners);
  SES.owners = owners;
  if (changed) { SES.sentKeys = {}; SES.presSent = {}; }
  // états rapides publiés dans la présence des titulaires
  for (const p of SES.peers) {
    if (p.sameTab) continue;
    const pr = p.presence || {};
    if (SES.hostPeer && p.peer === SES.hostPeer.peer && pr.m && pr.m !== SES.lastPres['m']) { SES.lastPres['m'] = pr.m; pushSnap(pr.m); }
    for (const id in SLICES) {
      const s = SLICES[id];
      if (s.via !== 'presence' || owners[id] !== p.peer) continue;
      const v = pr[s.field];
      if (v && v !== SES.lastPres[id]) { SES.lastPres[id] = v; try { s.apply(v); } catch (e) { console.error(e); } }
    }
    // caméra tenue par un cadreur : l'hôte l'applique, son cadre repart ensuite vers tous
    const lk = SES.lastPres['k' + p.peer];
    if (pr.k && pr.k !== lk) { SES.lastPres['k' + p.peer] = pr.k; const c = camById(pr.k.id); if (c && S.camop !== c && isHost()) { c.manual = true; c.yaw.v = pr.k.y; c.pitch.v = pr.k.p; c.lf.v = pr.k.f; c.applyPose(); } }
    else if (!pr.k && lk) { SES.lastPres['k' + p.peer] = null; const c = camById(lk.id); if (c && S.camop !== c) c.manual = c.role === 'manuel'; }
  }
  if (ch.joined.some((p) => !p.sameTab)) { SES.sentKeys = {}; SES.presSent = {}; }
  // arrivées et départs : annoncés quand le pseudo est connu (sur le réseau local, la présence suit
  // l'arrivée de peu) ; un joueur qui se reconnecte n'est ni « parti » ni « arrivé »
  const keyOf = (p) => (p.presence && p.presence.bid) || p.peer;
  const here = new Set(SES.peers.filter((p) => !p.sameTab).map(keyOf));
  for (const p of ch.left) { const k = keyOf(p); if (!here.has(k) && SES.known.has(k)) { log(`Départ : ${SES.known.get(k)}.`); SES.known.delete(k); } }
  for (const p of SES.peers) {
    if (p.sameTab || !p.presence || !p.presence.since) continue;
    const k = keyOf(p);
    if (!SES.known.has(k)) { SES.known.set(k, pseudoOf(p)); log(`Arrivée : ${pseudoOf(p)} (${roleLabel(p)}).`); }
  }
  if (ch.joined.length || ch.left.length) resolveNames();
  emit('session', { type: 'peers' });
}
function electHost() {
  const cands = SES.peers.filter((p) => p.presence && p.presence.since);
  // celui qui a créé la partie (hôte) fait tourner le match ; sinon le formateur ; sinon le plus ancien arrivé
  cands.sort((a, b) => (Number(!!b.presence.host) - Number(!!a.presence.host)) || (Number(b.presence.role === 'formateur') - Number(a.presence.role === 'formateur')) || (Number(a.presence.since) - Number(b.presence.since)) || (a.peer < b.peer ? -1 : 1));
  const h = cands[0] || null;
  const wasHost = isHost();
  SES.hostPeer = h;
  const nowHost = isHost();
  if (wasHost !== nowHost || SES.follower === nowHost) {
    SES.follower = !nowHost && !!h; S.sessionFollower = SES.follower;
    if (nowHost) takeOverMatch();
    for (const c of S.cams) c.remotePose = SES.follower && S.camop !== c;
    emit('session', { type: 'host' });
  }
}
export const isHost = () => !SES.active || !SES.hostPeer || (SES.me && SES.hostPeer.peer === SES.me.peer);
export const isFollower = () => SES.active && SES.follower;
export function ownerOf(sliceId) { return SES.owners[sliceId] || null; }
// ce poste peut-il piloter cette tranche ?
export function canControl(sliceId) {
  if (!SES.active || !sliceId || !SES.me) return true;
  const o = SES.owners[sliceId];
  return !o || o === SES.me.peer;
}
export function holderOf(sliceId) { const o = SES.owners[sliceId]; return SES.peers.find((p) => p.peer === o) || null; }
export function nameOf(p) {
  if (!p) return '—';
  const pr = p.presence || {};
  const id = p.by || pr.uid;
  const n = (pr.name && String(pr.name).slice(0, 24)) || (id && SES.names[id] && SES.names[id].name) || 'participant';
  return p.sameTab ? n + ' (vous)' : n;
}
export const pseudoOf = (p) => (p && p.presence && p.presence.name && String(p.presence.name).slice(0, 24)) || 'participant';
export function roleLabel(p) { const r = p && p.presence && p.presence.role; return r && ROLES_S[r] ? ROLES_S[r].label + (r === 'cadreur' && p.presence.cam ? ' CAM ' + p.presence.cam : '') : '—'; }
let namesP = 0;
async function resolveNames() {
  const ids = [...new Set(SES.peers.map((p) => p.by || (p.presence && p.presence.uid)).filter(Boolean))];
  if (!SH.user || !ids.length) return;
  const t = ++namesP;
  try { const r = await SH.user.profiles(ids); if (t === namesP) { SES.names = r || {}; emit('session', { type: 'names' }); } } catch (e) { /* noms indisponibles */ }
}

// ---------------- messages ----------------
/** l'hôte de la partie ou le formateur : eux seuls injectent une panne (force) ou attribuent un rôle */
function mayDirect(peerId) {
  const from = SES.peers.find((p) => p.peer === peerId);
  return !!from && ((!!SES.hostPeer && from.peer === SES.hostPeer.peer) || (!!from.presence && from.presence.role === 'formateur'));
}
function onMsg(topic, m) {
  if (m.sameTab) return;
  const d = m.data || {};
  if (topic === 'hello') { SES.sentKeys = {}; SES.presSent = {}; return; }
  if (topic === 'sx' || topic === 'force') {
    const s = SLICES[d.s]; if (!s) return;
    // une tranche n'est acceptée que de son titulaire ; une panne forcée, que de l'hôte ou du formateur
    if (topic === 'sx' && SES.owners[d.s] !== m.peer) return;
    if (topic === 'force' && !mayDirect(m.peer)) return;
    try { if (s.multi) s.applyPart(d.p, d.v); else s.apply(d.v); } catch (e) { console.error(e); }
    const k = s.multi ? d.s + '/' + d.p : d.s;
    SES.sentKeys[k] = JSON.stringify(d.v);
    if (topic === 'force') emit('session', { type: 'force', s: d.s });
    return;
  }
  if (topic === 'evt') { if (isFollower()) SES.evq.push(d); return; }
  if (topic === 'cmt') { if (isFollower()) emit('remoteCommentary', d); return; }
  if (topic === 'ord') { onOrder(d, m); return; }
  if (topic === 'ses') {
    if (d.type === 'note') log('Formateur : ' + String(d.text || '').slice(0, 300), 'warn');
    // l'hôte (ou le formateur) attribue un rôle à un joueur
    if (d.type === 'assign' && SES.me && d.to === SES.me.peer && ROLES_S[d.role]) {
      const from = SES.peers.find((p) => p.peer === m.peer);
      if (from && mayDirect(m.peer)) {
        setRole(d.role, d.role === 'cadreur' ? (d.cam || 1) : null);
        log(`${pseudoOf(from)} vous confie le rôle ${ROLES_S[d.role].label}${d.role === 'cadreur' ? ' (CAM ' + (d.cam || 1) + ')' : ''}.`, 'warn');
        emit('session', { type: 'assigned', role: d.role, by: pseudoOf(from) });
      }
    }
    emit('session', { type: 'ses', d });
  }
}
// ordres du réalisateur et messages
export function sendOrder(kind, data = {}) {
  const o = { kind, at: Date.now(), from: SES.role, ...data };
  send('ord', o);
  SES.orders.push({ ...o, mine: true }); if (SES.orders.length > 60) SES.orders.shift();
  if (SES.report) SES.report.orders.push({ ...o });
  emit('session', { type: 'order', o, mine: true });
}
function onOrder(d, m) {
  const o = { ...d, by: m.peer };
  SES.orders.push(o); if (SES.orders.length > 60) SES.orders.shift();
  if (SES.report) SES.report.orders.push({ kind: d.kind, n: d.n, at: Date.now(), from: d.from, text: d.text });
  emit('session', { type: 'order', o, mine: false });
}

// ---------------- boucle ----------------
let snapAcc = 0, sliceAcc = 0;
export function updateSession(dt) {
  if (!SES.active || !SES.named) return;
  // l'hôte publie le match ; chacun publie les états rapides des tranches qu'il tient
  snapAcc += dt;
  if (snapAcc >= 1 / SNAP_HZ) {
    snapAcc = 0;
    const patch = {};
    if (isHost()) patch.m = hostSnapshot();
    for (const id in SLICES) {
      const s = SLICES[id];
      if (s.via !== 'presence' || !mine(id)) continue;
      const k = sliceKey(id);
      if (SES.presSent[id] !== k) { SES.presSent[id] = k; patch[s.field] = s.get(); }
    }
    // où je suis (pour mon avatar chez les autres) : envoyé seulement quand ça change
    if (avatarSrc) {
      const a = avatarSrc();
      const av = { p: [r2(a.x), r2(a.y), r2(a.z)], a: r2(a.yaw), t: a.truck ? 1 : 0, f: a.fly ? 1 : 0, s: a.station || null, c: a.cam || null };
      const k = JSON.stringify(av);
      if (SES.presSent.av !== k) { SES.presSent.av = k; patch.av = av; }
    }
    // caméra que je cadre moi-même
    if (S.mode === 'camop' && S.camop) patch.k = { id: S.camop.id, y: r3(S.camop.yaw.v), p: r3(S.camop.pitch.v), f: r3(S.camop.lf.v) };
    else if (SES.presSent.k) patch.k = null;
    SES.presSent.k = !!patch.k;
    if (Object.keys(patch).length) pres(patch);
  }
  // états par à-coups : comparés 5 fois par seconde, envoyés seulement s'ils ont changé
  sliceAcc += dt;
  if (sliceAcc >= 0.2) {
    sliceAcc = 0;
    let budget = 12;
    for (const id in SLICES) {
      const s = SLICES[id];
      if (s.via !== 'event' || !mine(id)) continue;
      const parts = s.multi ? s.parts() : [null];
      for (const p of parts) {
        const k = s.multi ? id + '/' + p : id;
        const v = s.multi ? s.getPart(p) : s.get();
        if (v == null) continue;
        const j = JSON.stringify(v);
        if (SES.sentKeys[k] === j) continue;
        if (budget-- <= 0) break;
        SES.sentKeys[k] = j;
        send('sx', { s: id, p, v });
      }
    }
  }
}
const mine = (id) => SES.me && SES.owners[id] === SES.me.peer;
let avatarSrc = null;
// main.js fournit la position du joueur (x, y, z, yaw, truck, fly, station, cam)
export function setAvatarSource(fn) { avatarSrc = fn; }

// ---------------- match : hôte → suiveurs ----------------
function hostSnapshot() {
  const h = [];
  for (const p of M.humans) h.push(r2(p.x), r2(p.z), r2(p.heading), r2(((p.phase % TAU) + TAU) % TAU), Math.round(Math.min(p.speed || 0, 9.9) * 10) * 10 + (p.celebrate ? 1 : 0));
  const b = M.ball;
  const cp = [];
  for (const c of S.cams) { const a = [c.id, r3(c.yaw.v), r3(c.pitch.v), r3(c.lf.v)]; if (c.T.moving) { const q = c.cam.position; a.push(r2(q.x), r2(q.y), r2(q.z)); } cp.push(a); }
  return { t: r3(S.simTime), st: M.state, cl: r2(M.clock), sc: M.score.slice(), o: M.owner, s: M.scorer, ct: M.celebrateTeam, x: [r2(M.excite[0]), r2(M.excite[1])], b: [r2(b.x), r2(b.y), r2(b.z)], h, cp, ps: [Math.round(M.possession[0]), Math.round(M.possession[1])], sh: M.shots.slice() };
}
function pushSnap(m) {
  if (!m || typeof m.t !== 'number' || !Array.isArray(m.h)) return;
  const last = SES.buf[SES.buf.length - 1];
  if (last && m.t <= last.m.t) { if (last.m.t - m.t > 5) SES.buf = []; else return; }
  SES.buf.push({ m, recv: performance.now() });
  if (SES.buf.length > 40) SES.buf.shift();
}
// relais des commentaires dits par l'hôte
on('commentary', (l) => { if (SES.active && isHost() && l && !l.remote) send('cmt', { spk: l.spk, text: l.text, prio: l.prio, rate: l.rate, pitch: l.pitch }); });
// relais des faits de jeu de l'hôte (sons, commentaires, excitation)
on('match', (e) => { if (SES.active && isHost() && !e._remote && e.type !== 'bounce') send('evt', { ...e, t: r3(S.simTime) }); });
export function followMatch(dt) {
  const B = SES.buf; if (!B.length) return false;
  const last = B[B.length - 1];
  const hostNow = last.m.t + (performance.now() - last.recv) / 1000;
  let rt = hostNow - DELAY;
  if (SES.rt != null && rt < SES.rt && SES.rt - rt < 1.5) rt = SES.rt + dt * 0.25; // jamais en arrière
  SES.rt = rt;
  let a = B[0], b = B[0];
  for (let i = 0; i < B.length; i++) { if (B[i].m.t <= rt) a = B[i]; if (B[i].m.t >= rt) { b = B[i]; break; } b = B[i]; }
  const span = b.m.t - a.m.t; const k = span > 1e-4 ? clamp((rt - a.m.t) / span, 0, 1) : 1;
  const A = a.m, Bm = b.m;
  for (let i = 0; i < M.humans.length; i++) {
    const h = M.humans[i]; const j = i * 5; if (A.h.length < j + 5) break;
    const px = h.x, pz = h.z;
    h.x = A.h[j] + (Bm.h[j] - A.h[j]) * k; h.z = A.h[j + 1] + (Bm.h[j + 1] - A.h[j + 1]) * k;
    h.heading = lerpAngle(A.h[j + 2], Bm.h[j + 2], k); h.phase = lerpAngle(A.h[j + 3], Bm.h[j + 3], k);
    const f = Math.round(k < 0.5 ? A.h[j + 4] : Bm.h[j + 4]);
    h.speed = Math.floor(f / 10) / 10; h.celebrate = f % 10 === 1 ? 1 : 0;
    if (dt > 0) { h.vx = (h.x - px) / dt; h.vz = (h.z - pz) / dt; }
  }
  const bb = M.ball; const ox = bb.x, oz = bb.z;
  bb.x = A.b[0] + (Bm.b[0] - A.b[0]) * k; bb.y = A.b[1] + (Bm.b[1] - A.b[1]) * k; bb.z = A.b[2] + (Bm.b[2] - A.b[2]) * k;
  if (dt > 0) { bb.vx = clamp((bb.x - ox) / dt, -40, 40); bb.vz = clamp((bb.z - oz) / dt, -40, 40); }
  M.state = A.st; M.clock = A.cl + (Bm.cl - A.cl) * k; M.score = A.sc.slice(); M.owner = A.o; M.scorer = A.s; M.celebrateTeam = A.ct;
  M.excite[0] = A.x[0]; M.excite[1] = A.x[1];
  if (A.ps) { M.possession[0] = A.ps[0]; M.possession[1] = A.ps[1]; } if (A.sh) M.shots = A.sh.slice();
  S.simTime = rt;
  // cadres des caméras (sauf celle que je tiens moi-même)
  const cb = new Map((Bm.cp || []).map((x) => [x[0], x]));
  for (const ca of A.cp || []) {
    const c = camById(ca[0]); if (!c || S.camop === c) continue;
    const cB = cb.get(ca[0]) || ca;
    c.remotePose = true; c.manual = false;
    c.yaw.v = lerpAngle(ca[1], cB[1], k); c.pitch.v = ca[2] + (cB[2] - ca[2]) * k; c.lf.v = ca[3] + (cB[3] - ca[3]) * k;
    if (ca.length > 4) c.cam.position.set(ca[4] + (cB[4] - ca[4]) * k, ca[5] + (cB[5] - ca[5]) * k, ca[6] + (cB[6] - ca[6]) * k);
  }
  // faits de jeu au bon moment
  if (SES.evq.length) {
    SES.evq.sort((x, y) => x.t - y.t);
    while (SES.evq.length && SES.evq[0].t <= rt) { const e = SES.evq.shift(); if (rt - e.t < 2) emit('match', { ...e, _remote: true }); }
  }
  return true;
}
// l'hôte part : la page suivante reprend le match là où il était
function takeOverMatch() {
  for (const c of S.cams) c.remotePose = false;
  if (!SES.buf.length) return;
  M.stateT = 1; M.decision = 0.5; M.noControl = 0.3;
  if (M.state === 'celebration') M.stateT = 3;
  log('Vous faites maintenant tourner le match pour la session (hôte).', 'warn');
}

// ---------------- formateur : panne injectée chez les titulaires ----------------
// on mémorise l'état de toutes les tranches, on injecte la panne localement, puis on
// pousse aux titulaires les tranches modifiées
export function forceChangedSlices(before) {
  for (const id in SLICES) {
    const s = SLICES[id];
    const parts = s.multi ? s.parts() : [null];
    for (const p of parts) {
      const k = s.multi ? id + '/' + p : id;
      const now = sliceKey(id, p);
      if (before[k] !== now) send('force', { s: id, p, v: s.multi ? s.getPart(p) : s.get() });
    }
  }
}
export function assignRole(peerId, role, cam) {
  if (!ROLES_S[role]) return;
  if (SES.me && peerId === SES.me.peer) { setRole(role, role === 'cadreur' ? (cam || 1) : null); return; }
  send('ses', { type: 'assign', to: peerId, role, cam: cam || null });
  const p = SES.peers.find((x) => x.peer === peerId);
  log(`Vous confiez le rôle ${ROLES_S[role].label} à ${pseudoOf(p)}.`);
}
export function announce(text) { send('ses', { type: 'note', text: String(text).slice(0, 300) }); log('Vous (formateur) : ' + text); }
export function chat(text) { sendOrder('msg', { text: String(text).slice(0, 300) }); }
