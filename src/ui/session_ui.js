import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { $, modal, toast, intercom, selectEl } from './common.js';
import { SES, ROLES_S, getRoom, joinSession, leaveSession, setRole, isHost, holderOf, canControl, nameOf, roleLabel, sendOrder, chat, announce, forceChangedSlices, randomCode } from '../multi/session.js';
import { STATION_SLICE, allKeys, SLICES } from '../multi/slices.js';
import { FAULTS, injectFault, ACTIVE } from '../faults.js';
import { MIX, meSource, sourceLabel } from '../pipeline.js';
import { canConfigure, saveSessionReport, offerDownload } from '../shared.js';
import { AU } from '../audio.js';

// ----------------------------------------------------------------------------------
// Interface des sessions à plusieurs : rejoindre, rôles, participants, ordres et messages,
// commandes du formateur (pannes, annonces, compte rendu), postes verrouillés.
// ----------------------------------------------------------------------------------
const ORDER_TXT = { prep: (o) => `Prépare la ${o.label || o.n}…`, cut: () => 'Top !', mix: () => 'Enchaîne !', stinger: () => 'Volet logo, envoie !', replay: () => 'EVS, ralenti de l\'action !', dsk1: () => 'Le score !', lower: (o) => `Bandeau sur le ${o.label || ''}`, msg: (o) => o.text || '' };
export const orderText = (o) => (ORDER_TXT[o.kind] ? ORDER_TXT[o.kind](o) : o.kind);
let startCb = null;
export function setSessionStarter(fn) { startCb = fn; }

export async function openSessionPanel() {
  const body = el('div', { class: 'list' });
  modal.open('Session à plusieurs', body, { width: 980 });
  body.append(el('p', { class: 'note' }, 'Connexion…'));
  const room = await getRoom();
  if (!modal.isOpen) return;
  body.innerHTML = '';
  if (!room) {
    body.append(el('p', {}, 'La session à plusieurs fonctionne dans la page publiée sur claude.ai, quand vous êtes connecté.'),
      el('ul', {}, el('li', {}, 'Le formateur partage la page avec les stagiaires (niveau « Contributeur » au moins, depuis le menu Partager).'), el('li', {}, 'Chacun ouvre le même lien, clique « Session à plusieurs » et tape le même code.'), el('li', {}, 'Ici, la connexion temps réel n\'est pas disponible (page ouverte hors de claude.ai, ou accès en lecture seule).')));
    return;
  }
  if (!SES.active) drawJoin(body); else drawActive(body);
}

function drawJoin(body) {
  let role = SES.role !== 'observateur' ? SES.role : (canConfigure() ? 'formateur' : 'truquiste');
  const code = el('input', { type: 'text', value: SES.code || randomCode(), maxlength: 12, style: { width: '140px', fontFamily: 'var(--f-mono)', fontSize: '20px', textTransform: 'lowercase' }, 'aria-label': 'Code de session' });
  const camSel = selectEl([...Array(16).keys()].map((i) => [i + 1, 'CAM ' + (i + 1)]), SES.cam || 1, () => {});
  const cards = el('div', { class: 'ses-roles' });
  const draw = () => { cards.innerHTML = ''; for (const [k, r] of Object.entries(ROLES_S)) cards.append(el('button', { class: 'ses-role' + (k === role ? ' on' : ''), onclick: () => { role = k; draw(); camRow.hidden = role !== 'cadreur'; } }, el('b', {}, r.label), el('small', {}, r.desc))); };
  const camRow = el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Caméra'), camSel); camRow.hidden = role !== 'cadreur';
  draw();
  const go = async () => {
    const r = await joinSession(code.value, role, { cam: role === 'cadreur' ? +camSel.value : null, cfg: startCb ? startCb.cfg() : null });
    if (!r.ok) { toast(r.why === 'not_permitted' ? 'Accès refusé : demandez au formateur de vous partager la page au niveau Contributeur.' : 'Impossible de rejoindre la session (' + r.why + ').', 'bad', 7000); return; }
    modal.close();
    if (S.mode === 'start' && startCb) await startCb.start();
    toast(`Session ${r.code} : vous êtes ${ROLES_S[role].label}. Donnez ce code aux autres participants.`, 'good', 7000);
  };
  body.append(el('p', {}, 'Plusieurs stagiaires dans le même car, en direct : un réalise, un autre est au mélangeur, un autre au son ou à l\'EVS… Le formateur injecte des pannes et récupère un compte rendu. Tout le monde voit le même match.'),
    el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Code de la session'), code, el('button', { class: 'btn small', onclick: () => { code.value = randomCode(); } }, 'Nouveau code'), el('span', { class: 'note' }, 'Même code = même car. Le formateur crée le code et le donne aux stagiaires.')),
    el('h3', {}, 'Votre rôle'), cards, camRow,
    el('p', { class: 'note' }, 'Le premier formateur arrivé (sinon le premier participant) fait tourner le match pour tous. Un poste tenu par quelqu\'un d\'autre s\'ouvre en lecture seule : vous voyez ses réglages en direct.'),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn primary', onclick: go }, 'Rejoindre la session')));
}

function drawActive(body) {
  const tabs = el('div', { class: 'tabs' }); const content = el('div', { class: 'list' });
  const T = [['peers', 'Participants'], ['orders', 'Ordres et messages']];
  if (SES.role === 'formateur') T.push(['trainer', 'Formateur']);
  let cur = 'peers';
  const show = (k) => { cur = k; content.innerHTML = ''; [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.k === k)); ({ peers: tabPeers, orders: tabOrders, trainer: tabTrainer })[k](content); };
  for (const [k, l] of T) tabs.append(el('button', { class: 'tab', 'data-k': k, onclick: () => show(k) }, l));
  body.append(el('div', { class: 'hwrow' }, el('span', { class: 'pill ' + (SES.connected ? 'ok' : 'warn') }, SES.connected ? 'connecté' : 'connexion…'), el('b', { style: { fontFamily: 'var(--f-mono)', fontSize: '18px' } }, 'Session ' + SES.code), el('span', { class: 'note' }, `Vous : ${ROLES_S[SES.role].label}${isHost() ? ' · vous faites tourner le match (hôte)' : ''}`),
    el('button', { class: 'btn small', onclick: async () => { await finishIfTrainer(); await leaveSession(); modal.close(); toast('Vous avez quitté la session.'); } }, 'Quitter la session')), tabs, content);
  show(cur);
  panelRefresh = (e) => {
    if (!content.isConnected) { panelRefresh = null; return; }
    if (cur === 'orders' && e.type === 'order') { const f = content.querySelector('.ses-feed'); if (f) { f.prepend(orderRow(e.o)); return; } }
    if (cur === 'trainer' && e.type !== 'fault') return;
    if (['peers', 'names', 'order', 'log', 'role', 'host', 'fault'].includes(e.type)) show(cur);
  };
}
let panelRefresh = null;
on('session', (e) => { if (panelRefresh) panelRefresh(e); });
on('fault', () => { if (panelRefresh) panelRefresh({ type: 'fault' }); });
const orderRow = (o) => el('div', { class: 'ses-ord' + (o.mine ? ' mine' : '') }, el('b', {}, ROLES_S[o.from] ? ROLES_S[o.from].label : o.from), ' ', orderText(o), el('small', { class: 'note' }, ' · ' + new Date(o.at).toLocaleTimeString('fr-FR')));

function tabPeers(box) {
  const tb = el('tbody');
  for (const p of SES.peers) {
    const r = p.presence && p.presence.role;
    const owned = Object.keys(SLICES).filter((id) => SES.owners[id] === p.peer);
    tb.append(el('tr', { class: p.sameTab ? 'ses-me' : '' }, el('td', {}, nameOf(p), p.guest ? el('small', { class: 'note' }, ' (invité)') : null), el('td', {}, roleLabel(p)), el('td', {}, SES.hostPeer && SES.hostPeer.peer === p.peer ? 'hôte (match)' : ''), el('td', { class: 'note' }, owned.map((id) => SLICE_LABEL[id] || id).join(', ') || '—')));
  }
  const roleSel = selectEl(Object.entries(ROLES_S).map(([k, r]) => [k, r.label]), SES.role, (v) => { setRole(v, v === 'cadreur' ? (SES.cam || 1) : null); });
  box.append(el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, ...['Participant', 'Rôle', '', 'Pilote'].map((h) => el('th', {}, h)))), tb),
    el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Changer de rôle'), roleSel),
    el('h3', {}, 'Journal'), el('div', { class: 'ses-log' }, ...SES.log.slice(-14).reverse().map((l) => el('div', { class: 'note ' + (l.kind || '') }, `${new Date(l.at).toLocaleTimeString('fr-FR')} · ${l.text}`))));
}
const SLICE_LABEL = { mix: 'mélangeur', evs: 'EVS', gfx: 'habillage', router: 'grille', tech: 'transmission / HF', audio: 'console son', cams: 'RCP (vision)', links: 'baie CCU', rig: 'dispositif caméras' };

function tabOrders(box) {
  const feed = el('div', { class: 'ses-feed' });
  for (const o of SES.orders.slice(-30).reverse()) feed.append(orderRow(o));
  const inp = el('input', { type: 'text', maxlength: 300, placeholder: 'Message à tous (intercom)', style: { flex: '1' } });
  const sendMsg = () => { if (!inp.value.trim()) return; chat(inp.value.trim()); inp.value = ''; };
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') sendMsg(); });
  box.append(el('div', { class: 'hwrow' }, inp, el('button', { class: 'btn primary small', onclick: sendMsg }, 'Envoyer')),
    el('p', { class: 'note' }, 'Le réalisateur donne ses ordres depuis son poste (boutons « Prépare », « Top », « Enchaîne »…) : ils s\'affichent en grand chez le truquiste et l\'opérateur ralentis.'), feed);
}

// ---------------- formateur ----------------
function tabTrainer(box) {
  const ok = FAULTS.filter((f) => !f.net && f.can());
  const sel = selectEl(ok.map((f) => [f.id, `${f.label} (${f.where})`]), ok[0] && ok[0].id, () => {});
  const hidden = el('input', { type: 'checkbox', checked: true, id: 'ses-hid' });
  const note = el('input', { type: 'text', maxlength: 300, placeholder: 'Annonce à tous (ex. « On prend l\'antenne dans 2 minutes »)', style: { flex: '1' } });
  note.addEventListener('keydown', (e) => e.stopPropagation());
  const act = el('tbody');
  for (const a of ACTIVE.filter((x) => x.session)) act.append(el('tr', {}, el('td', {}, a.f.label), el('td', {}, a.f.where), el('td', { class: a.done ? 'ok' : 'err' }, a.done ? `résolue en ${Math.round(a.dt)} s` : 'en cours')));
  box.append(el('p', { class: 'note' }, 'La panne est injectée chez le stagiaire qui tient le poste concerné (et chez tous). Les pannes du réseau IP ne sont pas proposées en session.'),
    el('div', { class: 'hwrow' }, sel, el('label', { for: 'ses-hid', class: 'hwrow' }, hidden, 'cachée'), el('button', { class: 'btn primary', onclick: () => trainerInject(sel.value, hidden.checked) }, 'Injecter')),
    el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, el('th', {}, 'Panne'), el('th', {}, 'Où'), el('th', {}, 'État'))), act),
    el('div', { class: 'hwrow' }, note, el('button', { class: 'btn small', onclick: () => { if (note.value.trim()) { announce(note.value.trim()); note.value = ''; } } }, 'Annoncer')),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn', onclick: () => downloadReport() }, 'Compte rendu (HTML)'), el('button', { class: 'btn primary', onclick: async () => { const r = await finishIfTrainer(true); toast(r && r.ok ? 'Compte rendu enregistré (Espace formateur → Stagiaires).' : 'Compte rendu non enregistré : ' + ((r && (r.message || r.code)) || 'indisponible'), r && r.ok ? 'good' : 'bad'); } }, 'Enregistrer le compte rendu')));
}
function trainerInject(id, hidden) {
  const before = allKeys();
  const e = injectFault(id, hidden);
  if (!e) return;
  e.session = true;
  forceChangedSlices(before);
  announce(hidden ? 'La chaîne signale un problème. Chacun vérifie son poste !' : `Panne : ${e.f.label} (${e.f.where}).`);
  if (SES.report) SES.report.faults.push({ id, label: e.f.label, where: e.f.where, at: Date.now(), hidden });
  if (panelRefresh) panelRefresh({ type: 'fault' });
}
// compte rendu : ordres du réalisateur et temps de réaction du truquiste, pannes, journal
function buildReport() {
  const R = SES.report || { orders: [], faults: [] };
  const mixLog = SES.mixLog || [];
  const rows = [];
  for (const o of R.orders) {
    if (!['prep', 'cut', 'mix', 'stinger'].includes(o.kind)) continue;
    let done = null;
    if (o.kind === 'prep') done = mixLog.find((m) => m.at > o.at && m.pst === o.n);
    else done = mixLog.find((m) => m.at > o.at && m.pgmChanged);
    rows.push({ o, dt: done ? (done.at - o.at) / 1000 : null });
  }
  const faults = ACTIVE.filter((a) => a.session).map((a) => ({ label: a.f.label, where: a.f.where, done: a.done, dt: a.dt }));
  const people = SES.peers.map((p) => ({ name: nameOf(p), role: roleLabel(p) }));
  return { code: SES.code, startedAt: R.startedAt, endedAt: Date.now(), people, orders: rows.map((r) => ({ kind: r.o.kind, text: orderText(r.o), at: r.o.at, reaction: r.dt })), faults, log: SES.log.slice(-60) };
}
function reportHtml(r) {
  const h = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const reac = r.orders.filter((o) => o.reaction != null).map((o) => o.reaction);
  const avg = reac.length ? (reac.reduce((a, b) => a + b, 0) / reac.length).toFixed(1).replace('.', ',') : '—';
  return `<!doctype html><meta charset="utf-8"><title>Session ${h(r.code)}</title><style>body{font:14px system-ui;margin:24px;max-width:900px}td,th{border:1px solid #bbb;padding:4px 6px}table{border-collapse:collapse;width:100%}h2{margin-top:24px}</style>
<h1>Compte rendu de session ${h(r.code)}</h1><p>${h(new Date(r.startedAt).toLocaleString('fr-FR'))} → ${h(new Date(r.endedAt).toLocaleString('fr-FR'))}</p>
<h2>Participants</h2><ul>${r.people.map((p) => `<li>${h(p.name)} — ${h(p.role)}</li>`).join('')}</ul>
<h2>Ordres du réalisateur (${r.orders.length}) · réaction moyenne du truquiste : ${avg} s</h2><table><tr><th>Heure</th><th>Ordre</th><th>Réaction</th></tr>${r.orders.map((o) => `<tr><td>${h(new Date(o.at).toLocaleTimeString('fr-FR'))}</td><td>${h(o.text)}</td><td>${o.reaction == null ? 'non exécuté' : o.reaction.toFixed(1).replace('.', ',') + ' s'}</td></tr>`).join('')}</table>
<h2>Pannes</h2><table><tr><th>Panne</th><th>Où</th><th>Résultat</th></tr>${r.faults.map((f) => `<tr><td>${h(f.label)}</td><td>${h(f.where)}</td><td>${f.done ? 'résolue en ' + Math.round(f.dt) + ' s' : 'non résolue'}</td></tr>`).join('')}</table>
<h2>Journal</h2><ul>${r.log.map((l) => `<li>${h(new Date(l.at).toLocaleTimeString('fr-FR'))} · ${h(l.text)}</li>`).join('')}</ul>`;
}
function downloadReport() { offerDownload(`session-${SES.code}.html`, reportHtml(buildReport())); }
async function finishIfTrainer(force) {
  if (!SES.active || SES.role !== 'formateur' || (!force && !(SES.report && (SES.report.orders.length || SES.report.faults.length)))) return null;
  const r = buildReport();
  return saveSessionReport(`${SES.code}-${r.startedAt}`, r);
}

// ---------------- suivi du mélangeur (temps de réaction) ----------------
let lastMix = '';
export function trackMix() {
  if (!SES.active) return;
  const k = MIX.pgm + '/' + MIX.pst;
  if (k === lastMix) return;
  const [pg] = lastMix.split('/');
  lastMix = k;
  (SES.mixLog = SES.mixLog || []).push({ at: Date.now(), pgm: MIX.pgm, pst: MIX.pst, pgmChanged: String(MIX.pgm) !== pg });
  if (SES.mixLog.length > 400) SES.mixLog.shift();
}

// ---------------- bandeau de session et ordres reçus ----------------
export function updateSessionHud() {
  let chip = $('#ses-chip');
  if (!SES.active) { if (chip) chip.hidden = true; return; }
  if (!chip) { chip = el('button', { id: 'ses-chip', onclick: () => openSessionPanel() }); document.body.appendChild(chip); }
  chip.hidden = S.mode === 'start';
  const host = SES.hostPeer ? nameOf(SES.hostPeer) : '—';
  const txt = `● Session ${SES.code} · ${ROLES_S[SES.role].label} · ${SES.peers.length} en ligne · hôte : ${host}`;
  if (chip.textContent !== txt) chip.textContent = txt;
  chip.classList.toggle('off', !SES.connected);
  chip.classList.toggle('st', S.mode === 'station');
}
on('session', (e) => {
  if (e.type !== 'order' || e.mine) return;
  const o = e.o;
  const txt = orderText(o);
  const from = ROLES_S[o.from] ? ROLES_S[o.from].label.toUpperCase() : 'ORDRE';
  intercom(from, txt, o.kind === 'msg' ? '' : 'ok');
  // les ordres du réalisateur s'affichent en grand chez le truquiste et l'opérateur ralentis
  const forMe = o.kind === 'msg' || (o.kind === 'replay' ? SES.role === 'evs' : ['truquiste', 'habillage'].includes(SES.role));
  if (!forMe) return;
  let b = $('#order-osd');
  if (!b) { b = el('div', { id: 'order-osd', role: 'alert' }); document.body.appendChild(b); }
  b.innerHTML = ''; b.append(el('small', {}, from), el('b', {}, txt)); b.hidden = false; b.className = o.kind === 'cut' || o.kind === 'mix' || o.kind === 'stinger' ? 'go' : '';
  clearTimeout(b._t); b._t = setTimeout(() => { b.hidden = true; }, o.kind === 'msg' ? 5000 : 2600);
  beep(o.kind === 'cut' ? 1320 : 880);
});
function beep(f) {
  const ctx = AU.ctx; if (!ctx || AU.muted) return;
  const t = ctx.currentTime; const o = ctx.createOscillator(); const g = ctx.createGain();
  o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.2);
}

// ---------------- postes verrouillés ----------------
export function stationLocked(stationId) {
  const sl = STATION_SLICE[stationId];
  return !!(SES.active && sl && !canControl(sl));
}
export function applyStationLock(stationId) {
  const root = $('#station'); if (!root || root.hidden) return;
  const locked = stationLocked(stationId);
  root.classList.toggle('ses-lock', locked);
  let bar = root.querySelector('.ses-lockbar');
  if (!locked) { if (bar) bar.remove(); return; }
  const sl = STATION_SLICE[stationId];
  const p = holderOf(sl);
  const roleNeeded = Object.entries(ROLES_S).find(([, r]) => r.slices.includes(sl));
  const txt = p ? `Poste tenu par ${nameOf(p)} (${roleLabel(p)}) : vous voyez ses réglages en direct, sans pouvoir les modifier.` : `Poste piloté par l'hôte de la session. Prenez le rôle « ${roleNeeded ? roleNeeded[1].label : '?'} » pour le piloter.`;
  if (!bar) { bar = el('div', { class: 'ses-lockbar' }); const head = root.querySelector('.st-head'); if (head) head.after(bar); else root.prepend(bar); }
  bar.textContent = '🔒 ' + txt;
}
// en lecture seule, les commandes du poste ne réagissent pas (les onglets restent consultables)
let lockToastT = 0;
const lockRoot = document.getElementById('station');
if (lockRoot) for (const t of ['pointerdown', 'mousedown', 'click', 'input', 'change', 'wheel', 'keydown']) {
  lockRoot.addEventListener(t, (e) => {
    if (!lockRoot.classList.contains('ses-lock')) return;
    const x = e.target; if (!x || !x.closest) return;
    if (!x.closest('.st-body') || x.closest('.tabs, .vx-tabs, .tab, .vx-tab, .net-tabs, [data-ro-ok]')) return;
    if (t === 'keydown' && e.code === 'Escape') return;
    e.preventDefault(); e.stopPropagation();
    if (t === 'pointerdown' && performance.now() - lockToastT > 2500) { lockToastT = performance.now(); toast('Poste en lecture seule pendant la session.'); }
  }, { capture: true, passive: false });
}
// le réalisateur en session : ses ordres partent vers le truquiste humain s'il y en a un
export function humanTruquiste() { const p = holderOf('mix'); return p && !p.sameTab && p.presence && p.presence.role === 'truquiste' ? p : null; }
export function directorOrder(kind, n) {
  const label = n ? sourceLabel(meSource(n)).replace('CAM ', '') : '';
  sendOrder(kind, { n, label });
}
