import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { $, modal, toast, intercom, selectEl } from './common.js';
import { SES, ROLES_S, getRoom, joinSession, leaveSession, setRole, isHost, holderOf, canControl, nameOf, pseudoOf, roleLabel, sendOrder, chat, announce, forceChangedSlices, randomCode, transportKind, getPseudo, setPseudo, assignRole } from '../multi/session.js';
import { lanParties, lanSaveReport } from '../multi/lan.js';
import { downloadLanKit } from '../multi/lankit.js';
import { ROLE_COLORS } from '../multi/avatars.js';
import { ROLE_BRIEF, objectives, trackRoleStats, resetRoleStats, orderStats } from '../multi/roles.js';
import { STATION_INFO } from '../data.js';
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
  modal.open('Jouer à plusieurs', body, { width: 980 });
  body.append(el('p', { class: 'note' }, 'Connexion…'));
  const room = await getRoom();
  if (!modal.isOpen) return;
  body.innerHTML = '';
  if (!room) {
    body.append(el('p', {}, 'Pour jouer à plusieurs, deux possibilités :'),
      el('ul', {},
        el('li', {}, el('b', {}, 'Réseau local : '), 'la personne qui héberge lance le serveur fourni avec le simulateur (node lan/serveur.mjs, ou le fichier autonome car-regie-serveur-lan.mjs). Les autres ouvrent dans leur navigateur l\'adresse qu\'il affiche (http://192.168.x.x:8080). Personne d\'autre n\'a rien à installer.'),
        el('li', {}, el('b', {}, 'En ligne : '), 'dans la page publiée sur claude.ai, partagée aux stagiaires (niveau « Contributeur » au moins) : chacun ouvre le même lien et rejoint la même partie.')),
      el('p', { class: 'note' }, 'Ici, aucune connexion temps réel n\'est disponible (page ouverte hors du serveur réseau local et hors de claude.ai, ou accès en lecture seule).'),
      lanKitRow());
    return;
  }
  if (!SES.active) drawJoin(body); else drawActive(body);
}

// archive du serveur réseau local (assemblée par lankit.js)
async function lanKit() {
  const r = await downloadLanKit();
  if (r === 'unavailable') toast('Archive indisponible ici : le serveur réseau local est fourni avec les sources du simulateur (dossier lan, ou dist/car-regie-serveur-lan.mjs).', 'bad', 7000);
  else if (r === 'error') toast('Le téléchargement n\'a pas abouti.', 'bad');
}
const lanKitRow = () => el('div', { class: 'ses-kit' },
  el('div', {}, el('b', {}, 'Jouer sur un réseau local, sans Internet'), el('p', { class: 'note' }, 'La personne qui héberge télécharge le serveur (Windows, macOS, Linux : Node.js nécessaire), le lance, et donne aux autres l\'adresse qu\'il affiche.')),
  el('button', { class: 'btn small', onclick: () => lanKit() }, 'Télécharger le serveur réseau local (.zip)'));
function drawJoin(body) {
  const lan = transportKind() === 'lan';
  let role = SES.role !== 'observateur' ? SES.role : (canConfigure() && !lan ? 'formateur' : 'truquiste');
  let mode = 'join', party = null, parties = [], chose = false, polled = false, lastK = '';
  const pseudo = el('input', { type: 'text', value: getPseudo(), maxlength: 24, placeholder: 'Ex. Alice', class: 'ses-pseudo', id: 'ses-pseudo', autocomplete: 'nickname' });
  const code = el('input', { type: 'text', value: SES.code || randomCode(), maxlength: 12, class: 'ses-code', 'aria-label': 'Code de la partie' });
  for (const i of [pseudo, code]) i.addEventListener('keydown', (e) => e.stopPropagation());
  const camSel = selectEl([...Array(16).keys()].map((i) => [i + 1, 'CAM ' + (i + 1)]), SES.cam || 1, () => draw());
  const cards = el('div', { class: 'ses-roles' });
  const camRow = el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Caméra'), camSel);
  const taken = () => (mode === 'join' && party ? party.players : []);
  function draw() {
    cards.innerHTML = '';
    for (const [k, r] of Object.entries(ROLES_S)) {
      const who = taken().filter((p) => p.role === k && (k !== 'cadreur' || +p.cam === +camSel.value)).map((p) => p.name);
      cards.append(el('button', { class: 'ses-role' + (k === role ? ' on' : '') + (who.length ? ' taken' : ''), style: { '--rc': ROLE_COLORS[k] }, onclick: () => { role = k; draw(); } },
        el('b', {}, r.label), el('small', {}, r.desc), who.length ? el('em', {}, (k === 'cadreur' ? 'CAM ' + camSel.value + ' tenue par ' : 'Déjà pris par ') + who.join(', ') + (r.slices.length ? ' : vous seriez en lecture seule' : '')) : null));
    }
    camRow.hidden = role !== 'cadreur';
  }
  // parties du réseau local
  const list = el('div', { class: 'ses-parties' });
  function drawParties() {
    list.innerHTML = '';
    if (!parties.length) { list.append(el('p', { class: 'note' }, 'Aucune partie pour l\'instant. Demandez à l\'hôte de créer la sienne (onglet « Héberger »), la liste se met à jour toute seule.')); return; }
    for (const p of parties) {
      const sel = party && party.code === p.code;
      list.append(el('button', { class: 'ses-party' + (sel ? ' on' : ''), onclick: () => { party = p; drawParties(); draw(); } },
        el('b', {}, 'Partie de ' + p.host), el('span', { class: 'note' }, `${p.count} joueur${p.count > 1 ? 's' : ''} · ${p.players.map((x) => `${x.name}${x.role ? ' (' + (ROLES_S[x.role] ? ROLES_S[x.role].label : x.role) + ')' : ''}`).join(', ')}`)));
    }
  }
  let timer = 0;
  async function poll() {
    if (!body.isConnected) { clearInterval(timer); return; }
    const r = await lanParties(); if (!r) return;
    // on ne redessine que si la liste a changé (sinon un clic en cours tomberait sur un bouton remplacé)
    const k = JSON.stringify(r.parties || []);
    if (k === lastK && polled) return; lastK = k;
    parties = r.parties || [];
    if (party) party = parties.find((p) => p.code === party.code) || null;
    if (!party && parties.length === 1) party = parties[0];
    // première visite d'un réseau sans partie : on propose d'héberger
    if (!polled && !parties.length && !chose) { polled = true; show('host'); return; }
    polled = true;
    srvName.textContent = r.server ? 'serveur : ' + r.server : '';
    drawParties(); draw();
  }
  const srvName = el('span', { class: 'note' });
  const tabs = el('div', { class: 'tabs' });
  const pane = el('div', { class: 'list' });
  function show(m) {
    mode = m; [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.k === m));
    pane.innerHTML = '';
    if (m === 'host') pane.append(el('p', {}, lan ? 'Vous créez la partie : votre ordinateur fait tourner le match pour tout le monde. Les autres la verront dans « Rejoindre une partie ».' : 'Vous créez la partie et vous faites tourner le match. Donnez le code aux autres participants.'),
      lan ? null : el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Code'), code, el('button', { class: 'btn small', onclick: () => { code.value = randomCode(); } }, 'Nouveau code')));
    else if (lan) pane.append(el('div', { class: 'hwrow' }, el('b', {}, 'Parties sur ce réseau'), srvName), list);
    else pane.append(el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Code de la partie'), code, el('span', { class: 'note' }, 'Même code = même car.')));
    goBtn.textContent = m === 'host' ? 'Créer la partie' : 'Rejoindre';
    draw();
  }
  for (const [k, l] of [['host', 'Héberger une partie'], ['join', 'Rejoindre une partie']]) tabs.append(el('button', { class: 'tab', 'data-k': k, onclick: () => { chose = true; show(k); } }, l));
  const goBtn = el('button', { class: 'btn primary' }, 'Rejoindre');
  goBtn.onclick = async () => {
    const n = setPseudo(pseudo.value);
    if (!n) { pseudo.focus(); toast('Choisissez un pseudo : c\'est le nom que les autres verront au-dessus de votre personnage.', 'bad', 5000); return; }
    let c;
    if (mode === 'host') c = lan ? randomCode() : code.value;
    else if (lan) { if (!party) { toast('Choisissez une partie dans la liste.', 'bad'); return; } c = party.code.replace(/^car-/, ''); }
    else c = code.value;
    goBtn.disabled = true;
    const r = await joinSession(c, role, { cam: role === 'cadreur' ? +camSel.value : null, cfg: startCb ? startCb.cfg() : null, host: mode === 'host' });
    goBtn.disabled = false;
    if (!r.ok) { toast(r.why === 'not_permitted' ? 'Accès refusé : demandez au formateur de vous partager la page au niveau Contributeur.' : r.why === 'unreachable' ? 'Serveur réseau local injoignable : vérifiez qu\'il tourne toujours sur l\'ordinateur de l\'hôte.' : r.why === 'full' ? 'Partie complète.' : 'Impossible de rejoindre la partie (' + r.why + ').', 'bad', 7000); return; }
    clearInterval(timer); resetRoleStats();
    modal.close();
    if (S.mode === 'start' && startCb) await startCb.start();
    toast(mode === 'host' ? (lan ? `Partie créée. Les autres la rejoignent depuis l'adresse du serveur, onglet « Rejoindre ».` : `Partie ${r.code} créée : donnez ce code aux autres participants.`) : `Vous êtes ${ROLES_S[role].label}${role === 'cadreur' ? ' (CAM ' + camSel.value + ')' : ''}.`, 'good', 7000);
  };
  body.append(
    el('div', { class: 'ses-banner' + (lan ? ' lan' : '') }, el('b', {}, lan ? 'Réseau local' : 'En ligne'), el('span', {}, lan ? 'Tout le monde est sur le même réseau et a ouvert l\'adresse du serveur de l\'hôte.' : 'Tout le monde a ouvert la page publiée sur claude.ai.')),
    el('div', { class: 'hwrow' }, el('label', { class: 'rl', for: 'ses-pseudo' }, 'Votre pseudo'), pseudo, el('span', { class: 'note' }, 'Affiché au-dessus de votre personnage.')),
    tabs, pane,
    el('h3', {}, 'Votre rôle dans la prestation'), cards, camRow,
    el('p', { class: 'note' }, 'Chaque poste du car n\'est piloté que par celui qui tient le rôle ; les autres le voient en direct, en lecture seule. L\'hôte (ou le formateur) peut réattribuer les rôles une fois la partie lancée.'),
    el('div', { class: 'hwrow' }, goBtn),
    lan ? null : lanKitRow());
  show(lan ? 'join' : 'host');
  if (lan) { poll(); timer = setInterval(poll, 2000); }
}

function drawActive(body) {
  const tabs = el('div', { class: 'tabs' }); const content = el('div', { class: 'list' });
  const T = [['peers', 'Participants'], ['orders', 'Ordres et messages']];
  if (SES.role === 'formateur') T.push(['trainer', 'Formateur']);
  let cur = 'peers';
  const show = (k) => { cur = k; content.innerHTML = ''; [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.k === k)); ({ peers: tabPeers, orders: tabOrders, trainer: tabTrainer })[k](content); };
  for (const [k, l] of T) tabs.append(el('button', { class: 'tab', 'data-k': k, onclick: () => show(k) }, l));
  const title = SES.transport === 'lan' ? `Partie de ${SES.hostPeer ? pseudoOf(SES.hostPeer) : '…'} · réseau local` : 'Partie ' + SES.code;
  body.append(el('div', { class: 'hwrow' }, el('span', { class: 'pill ' + (SES.connected ? 'ok' : 'warn') }, SES.connected ? 'connecté' : 'reconnexion…'), el('b', { style: { fontFamily: 'var(--f-disp)', fontSize: '19px' } }, title), el('span', { class: 'note' }, `Vous : ${pseudoOf(SES.me)} · ${ROLES_S[SES.role].label}${isHost() ? ' · vous faites tourner le match (hôte)' : ''}`),
    el('button', { class: 'btn small', onclick: async () => { await finishIfTrainer(); await leaveSession(); modal.close(); toast('Vous avez quitté la partie.'); } }, 'Quitter la partie')), tabs, content);
  show(cur);
  let peersKey = '';
  panelRefresh = (e) => {
    if (!content.isConnected) { panelRefresh = null; return; }
    if (cur === 'orders' && e.type === 'order') { const f = content.querySelector('.ses-feed'); if (f) { f.prepend(orderRow(e.o)); return; } }
    if (cur === 'trainer' && e.type !== 'fault') return;
    // la présence change ~12 fois par seconde (match, positions) : on ne redessine que si la liste a vraiment changé
    if (cur === 'peers' && (e.type === 'peers' || e.type === 'names')) {
      const k = SES.peers.map((p) => [p.peer, nameOf(p), roleLabel(p), whereOf(p), SES.hostPeer && SES.hostPeer.peer === p.peer].join('/')).join('|') + SES.role;
      if (k === peersKey) return; peersKey = k;
      const a = document.activeElement; if (a && content.contains(a) && /SELECT|INPUT/.test(a.tagName)) return;
    }
    if (['peers', 'names', 'order', 'log', 'role', 'host', 'fault'].includes(e.type)) show(cur);
  };
}
let panelRefresh = null;
on('session', (e) => { if (panelRefresh) panelRefresh(e); });
on('fault', () => { if (panelRefresh) panelRefresh({ type: 'fault' }); });
const orderRow = (o) => el('div', { class: 'ses-ord' + (o.mine ? ' mine' : '') }, el('b', {}, ROLES_S[o.from] ? ROLES_S[o.from].label : o.from), ' ', orderText(o), el('small', { class: 'note' }, ' · ' + new Date(o.at).toLocaleTimeString('fr-FR')));

function whereOf(p) {
  const av = p.presence && p.presence.av; if (!av) return '—';
  if (av.c) return 'cadre la CAM ' + av.c;
  if (av.s) return 'au poste ' + (STATION_INFO[av.s] ? STATION_INFO[av.s].title : av.s);
  return av.t ? 'dans le car' : av.f ? 'en vol libre' : 'dans le stade';
}
const canAssign = () => isHost() || SES.role === 'formateur';
const PENDING = new Map();
function tabPeers(box) {
  box.append(roleBrief());
  const tb = el('tbody');
  for (const p of SES.peers) {
    const r = (p.presence && p.presence.role) || 'observateur';
    const owned = Object.keys(SLICES).filter((id) => SES.owners[id] === p.peer);
    let assign = null;
    if (canAssign()) {
      // attribution en cours : on garde le choix affiché le temps que la présence du joueur suive
      const pend = PENDING.get(p.peer); const fresh = pend && Date.now() - pend.at < 10000 && (pend.role !== r || (r === 'cadreur' && +pend.cam !== +((p.presence && p.presence.cam) || 0)));
      const r0 = fresh ? pend.role : r, c0 = fresh && pend.cam ? pend.cam : (p.presence && p.presence.cam) || 1;
      const camS = selectEl([...Array(16).keys()].map((i) => [i + 1, 'CAM ' + (i + 1)]), c0, (v) => { if (roleS.value === 'cadreur') { PENDING.set(p.peer, { role: 'cadreur', cam: +v, at: Date.now() }); assignRole(p.peer, 'cadreur', +v); } });
      const roleS = selectEl(Object.entries(ROLES_S).map(([k, x]) => [k, x.label]), r0, (v) => { camS.hidden = v !== 'cadreur'; PENDING.set(p.peer, { role: v, cam: v === 'cadreur' ? +camS.value : null, at: Date.now() }); assignRole(p.peer, v, v === 'cadreur' ? +camS.value : null); });
      camS.hidden = r0 !== 'cadreur';
      assign = el('td', {}, el('div', { class: 'hwrow' }, roleS, camS));
    }
    tb.append(el('tr', { class: p.sameTab ? 'ses-me' : '' },
      el('td', {}, el('span', { class: 'ses-dot', style: { background: ROLE_COLORS[r] || '#9aa3ab' } }), nameOf(p), p.guest ? el('small', { class: 'note' }, ' (invité)') : null),
      el('td', {}, roleLabel(p)), el('td', {}, SES.hostPeer && SES.hostPeer.peer === p.peer ? 'hôte (match)' : ''),
      el('td', { class: 'note' }, whereOf(p)),
      el('td', { class: 'note' }, owned.map((id) => SLICE_LABEL[id] || id).join(', ') || '—'), assign));
  }
  const heads = ['Joueur', 'Rôle', '', 'Où', 'Pilote'].concat(canAssign() ? ['Attribuer un rôle'] : []);
  const pseudoIn = el('input', { type: 'text', value: getPseudo(), maxlength: 24, style: { width: '160px' } });
  pseudoIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { setPseudo(pseudoIn.value); toast('Pseudo mis à jour.'); } });
  const roleSel = selectEl(Object.entries(ROLES_S).map(([k, r]) => [k, r.label]), SES.role, (v) => { setRole(v, v === 'cadreur' ? (SES.cam || 1) : null); });
  box.append(el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, ...heads.map((h) => el('th', {}, h)))), tb),
    el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Mon pseudo'), pseudoIn, el('button', { class: 'btn small', onclick: () => { setPseudo(pseudoIn.value); toast('Pseudo mis à jour.'); } }, 'Changer'), el('span', { class: 'rl' }, 'Mon rôle'), roleSel),
    el('h3', {}, 'Journal'), el('div', { class: 'ses-log' }, ...SES.log.slice(-14).reverse().map((l) => el('div', { class: 'note ' + (l.kind || '') }, `${new Date(l.at).toLocaleTimeString('fr-FR')} · ${l.text}`))));
}
// fiche du rôle : missions, objectifs en direct, accès au poste
function roleBrief() {
  const r = SES.role, B = ROLE_BRIEF[r] || { steps: [] };
  const go = goToRolePost ? el('button', { class: 'btn small primary', onclick: () => { modal.close(); goToRolePost(r, SES.cam); } }, r === 'cadreur' ? `Aller à la CAM ${SES.cam || 1}` : 'Aller à mon poste') : null;
  return el('div', { class: 'ses-brief', style: { '--rc': ROLE_COLORS[r] } },
    el('div', { class: 'hwrow' }, el('b', {}, 'Votre rôle : ' + ROLES_S[r].label + (r === 'cadreur' && SES.cam ? ' · CAM ' + SES.cam : '')), (B.station || r === 'cadreur') ? go : null),
    el('ol', {}, ...B.steps.map((t) => el('li', {}, t))),
    el('div', { class: 'ses-obj' }, ...objectives(r).map((o) => el('span', { class: o.ok === true ? 'is-ok' : o.ok === false ? 'is-bad' : '' }, o.label + ' : ', el('b', {}, o.value)))));
}
let goToRolePost = null;
export function setRolePostHandler(fn) { goToRolePost = fn; }
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
    el('div', { class: 'hwrow' }, el('button', { class: 'btn', onclick: () => downloadReport() }, 'Compte rendu (HTML)'), el('button', { class: 'btn primary', onclick: async () => { const r = await finishIfTrainer(true); toast(r && r.ok ? (r.file ? `Compte rendu enregistré sur l'ordinateur de l'hôte : ${r.file}.html` : 'Compte rendu enregistré (Espace formateur → Stagiaires).') : 'Compte rendu non enregistré : ' + ((r && (r.message || r.code)) || 'indisponible'), r && r.ok ? 'good' : 'bad'); } }, 'Enregistrer le compte rendu')));
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
  const people = SES.peers.map((p) => ({ name: pseudoOf(p), role: roleLabel(p) }));
  const os = orderStats();
  return { code: SES.code, transport: SES.transport, startedAt: R.startedAt, endedAt: Date.now(), people, mixer: os, orders: rows.map((r) => ({ kind: r.o.kind, text: orderText(r.o), at: r.o.at, reaction: r.dt })), faults, log: SES.log.slice(-60) };
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
  // réseau local : le compte rendu est écrit sur l'ordinateur de l'hôte (dossier « rapports » du serveur)
  if (SES.transport === 'lan') { const x = await lanSaveReport(`${SES.code}-${r.startedAt}`, r, reportHtml(r)); return x && x.ok ? { ok: true, file: x.file } : { ok: false, message: (x && x.message) || 'serveur injoignable' }; }
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
  const txt = `● ${SES.transport === 'lan' ? 'Réseau local' : 'Session ' + SES.code} · ${ROLES_S[SES.role].label}${SES.role === 'cadreur' && SES.cam ? ' CAM ' + SES.cam : ''} · ${SES.peers.length} en ligne · hôte : ${host}`;
  if (chip.textContent !== txt) chip.textContent = txt;
  chip.classList.toggle('off', !SES.connected);
  chip.classList.toggle('st', S.mode === 'station');
  const now = performance.now(); trackRoleStats(Math.min(1, (now - (hudT || now)) / 1000)); hudT = now;
  drawRoleCard();
}
let hudT = 0, cardKey = '';
// fiche de rôle dans l'interface : missions repliables, objectifs mesurés en direct
function drawRoleCard() {
  let card = $('#role-card');
  const show = SES.active && S.mode === 'fps';
  if (!card) {
    if (!show) return;
    card = el('aside', { id: 'role-card', 'aria-label': 'Votre rôle' });
    card.addEventListener('click', (e) => { if (e.target.closest('button')) return; card.classList.toggle('min'); cardKey = ''; drawRoleCard(); });
    $('#hud').appendChild(card);
  }
  card.hidden = !show; if (!show) return;
  const r = SES.role, B = ROLE_BRIEF[r] || { steps: [] }, obj = objectives(r);
  const key = r + SES.cam + card.classList.contains('min') + JSON.stringify(obj);
  if (key === cardKey) return; cardKey = key;
  card.style.setProperty('--rc', ROLE_COLORS[r]);
  card.innerHTML = '';
  const head = el('div', { class: 'rc-head' }, el('span', { class: 'tape' }, ROLES_S[r].label + (r === 'cadreur' && SES.cam ? ' · CAM ' + SES.cam : '')), el('span', { class: 'rc-tog', 'aria-hidden': 'true' }, card.classList.contains('min') ? '▸' : '▾'));
  card.append(head);
  if (card.classList.contains('min')) return;
  card.append(el('ol', {}, ...B.steps.map((t) => el('li', {}, t))));
  if (obj.length) card.append(el('ul', { class: 'rc-obj' }, ...obj.map((o) => el('li', { class: o.ok === true ? 'is-ok' : o.ok === false ? 'is-bad' : '' }, el('span', {}, o.label), el('b', {}, o.value)))));
  if (goToRolePost && (B.station || r === 'cadreur')) card.append(el('button', { class: 'btn small', onclick: () => goToRolePost(r, SES.cam) }, r === 'cadreur' ? `Aller à la CAM ${SES.cam || 1}` : 'Aller à mon poste'));
}
on('session', (e) => { if (e.type === 'role' || e.type === 'assigned' || e.type === 'leave') { cardKey = ''; drawRoleCard(); } if (e.type === 'assigned') toast(`${e.by} vous confie le rôle ${ROLES_S[e.role].label}.`, 'good', 6000); });
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
