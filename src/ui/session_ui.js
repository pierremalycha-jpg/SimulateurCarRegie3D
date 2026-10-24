// @ts-check
import { S, on } from '../state.js';
import { el } from '../util.js';
import { $, modal, toast, intercom, selectEl } from './common.js';
import { SES, ROLES_S, getRoom, joinSession, leaveSession, setRole, isHost, holderOf, canControl, nameOf, pseudoOf, roleLabel, sendOrder, chat, announce, forceChangedSlices, randomCode, transportKind, getPseudo, setPseudo, assignRole } from '../multi/session.js';
import { lanParties, lanSaveReport, internetKey, onHostMachine, internetStatus, internetAction } from '../multi/lan.js';
import { downloadLanKit } from '../multi/lankit.js';
import { ROLE_COLORS } from '../multi/avatars.js';
import { ROLE_BRIEF, objectives, trackRoleStats, resetRoleStats, orderStats } from '../multi/roles.js';
import { STATION_INFO } from '../content/stations.js';
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
  modal.open('Coopération', body, { width: 1040 });
  body.append(el('p', { class: 'note' }, 'Connexion…'));
  const room = await getRoom();
  if (!modal.isOpen) return;
  body.innerHTML = '';
  if (!room) {
    body.append(el('p', {}, 'Pour jouer à plusieurs, deux possibilités :'),
      el('ul', {},
        el('li', {}, el('b', {}, 'Réseau local : '), 'la personne qui héberge lance le serveur fourni avec le simulateur (TIEE-Simulator.exe sous Windows, sans rien installer ; ou, avec Node.js, le fichier car-regie-serveur-lan.mjs). Les autres ouvrent dans leur navigateur l\'adresse qu\'il affiche (http://192.168.x.x:8080). Personne d\'autre n\'a rien à installer.'),
        el('li', {}, el('b', {}, 'En ligne : '), 'dans la page publiée sur claude.ai, partagée aux stagiaires (niveau « Contributeur » au moins) : chacun ouvre le même lien et rejoint la même partie.')),
      // fichier ouvert d'un double-clic : le serveur ne peut pas être téléchargé depuis la page
      fileMode()
        ? el('p', { class: 'note' }, 'Cette copie est un fichier ouvert directement dans le navigateur : tout fonctionne en solo, sans Internet, et la progression reste dans ce navigateur. Pour jouer à plusieurs, l\'hôte lance TIEE-Simulator.exe ou le serveur réseau local (car-regie-reseau-local.zip), fournis avec ce fichier.')
        : el('p', { class: 'note' }, 'Ici, aucune connexion temps réel n\'est disponible (page ouverte hors du serveur réseau local et hors de claude.ai, ou accès en lecture seule).'),
      linkJoin(),
      ...(fileMode() ? [] : [lanKitRow()]));
    return;
  }
  if (!SES.active) drawJoin(body); else drawActive(body);
}

const fileMode = () => location.protocol === 'file:';
// copier un texte (adresse, code, lien)
const copyBtn = (txt, what) => el('button', { type: 'button', class: 'btn small', onclick: async () => { try { await navigator.clipboard.writeText(txt()); toast(what + ' copié' + (/^(Adresse|Clé)/.test(what) ? 'e' : '') + '.', 'good'); } catch (e) { toast('Copie impossible ici : sélectionnez le texte et copiez-le à la main.', 'bad'); } } }, 'Copier');

// ---------------- jouer par Internet ----------------
// l'invité a reçu un lien (http://86.x.x.x:8080/?cle=… ou https://….trycloudflare.com/?cle=…) : on l'ouvre
export function openInviteLink(v) {
  let s = String(v || '').trim();
  if (!s) return 'vide';
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  let u; try { u = new URL(s); } catch (e) { return 'illisible'; }
  if (!/^https?:$/.test(u.protocol) || !u.hostname) return 'illisible';
  location.href = u.href;
  return 'ok';
}
function linkJoin() {
  const inp = el('input', { type: 'text', class: 'ses-link', placeholder: 'http://… ?cle=…', 'aria-label': 'Lien reçu de l\'hôte', autocomplete: 'off', spellcheck: 'false' });
  const go = () => { const r = openInviteLink(inp.value); if (r !== 'ok') { inp.focus(); toast(r === 'vide' ? 'Collez d\'abord le lien que l\'hôte vous a envoyé.' : 'Ce lien n\'est pas lisible : recopiez-le en entier (il se termine par ?cle= et douze caractères).', 'bad', 6000); } };
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); });
  return el('div', { class: 'ses-linkjoin' },
    el('label', { class: 'sl-k' }, 'Vous avez reçu un lien de l\'hôte ?'),
    el('div', { class: 'hwrow' }, inp, el('button', { type: 'button', class: 'btn small primary', onclick: go }, 'Rejoindre')),
    el('p', { class: 'note' }, 'Collez-le ici (ou ouvrez-le directement dans votre navigateur) : la partie de l\'hôte s\'ouvre, par Internet, sans rien installer.'));
}
// bloc de l'hôte : analyse du réseau, ouverture de la box, lien par tunnel ; l'état vient du serveur
function internetBox() {
  const box = el('div', { class: 'ses-net', 'aria-live': 'polite' });
  let last = '', timer = 0, st = null;
  const act = async (a) => { const r = await internetAction(a); if (r) { st = r; draw(); } else toast('Le serveur ne répond pas : la fenêtre noire de TIEE Simulator est-elle toujours ouverte ?', 'bad', 6000); };
  const line = (k, v) => el('div', { class: 'sn-row' }, el('span', { class: 'sl-k' }, k), el('span', {}, v));
  function draw() {
    if (!st) return;
    const k = JSON.stringify(st); if (k === last) return; last = k;
    const D = st.direct, T = st.tunnel;
    const parts = [el('b', { class: 'sn-title' }, 'Inviter quelqu\'un par Internet')];
    if (st.lien) {
      parts.push(el('div', { class: 'sl-info sn-link' }, el('span', { class: 'sl-k' }, 'Lien à lui envoyer'), el('code', { class: 'sn-url' }, st.lien), copyBtn(() => st.lien, 'Lien'),
        el('p', { class: 'note' }, 'Envoyez-le par message. La personne l\'ouvre dans son navigateur (Chrome, Edge, Firefox), sans rien installer, puis « Rejoindre une partie ». Gardez cette fenêtre et la fenêtre noire ouvertes pendant la partie.')));
    }
    if (D.etat === 'non' && T.etat === 'non') {
      parts.push(el('p', { class: 'note' }, 'Pour une personne qui n\'est pas sur votre réseau. Le simulateur analyse votre réseau, ouvre le port de votre box tout seul (UPnP) et vous donne le lien à lui envoyer.'),
        el('button', { type: 'button', class: 'btn primary sn-go', onclick: () => act('direct') }, 'Inviter par Internet'));
    } else if (D.etat === 'recherche') parts.push(el('p', { class: 'note sn-wait' }, 'Analyse du réseau et ouverture de la box…'));
    else if (D.etat === 'ouvert') {
      if (D.partagee) parts.push(el('p', { class: 'note is-bad' }, `La box a ouvert le port, mais elle n'a pas d'adresse publique à elle (adresse de la box : ${D.wan || '?'}, vue d'Internet : ${D.publique || '?'}). Votre opérateur partage l'adresse entre plusieurs abonnés, ou deux box sont en cascade : un lien direct ne peut pas marcher. Créez un lien par tunnel.`));
      else if (D.verifie === true) parts.push(el('p', { class: 'note is-ok' }, 'Lien direct vérifié : il répond depuis Internet.'));
      else if (D.verifie === false) parts.push(el('p', { class: 'note' }, 'Lien direct créé, mais pas vérifiable depuis cet ordinateur (certaines box ne le permettent pas). Faites l\'essai avec la personne ; si la page ne s\'ouvre pas chez elle, créez plutôt un lien par tunnel.'));
      else parts.push(el('p', { class: 'note sn-wait' }, 'Vérification du lien…'));
    } else if (D.etat === 'echec' && T.etat !== 'pret') parts.push(el('p', { class: 'note is-bad' }, `La box n'a pas été ouverte : ${D.why}. Le plus simple : un lien par tunnel, qui marche sans toucher à la box.`));
    if (T.etat === 'pret' && st.lien === T.lien) parts.push(el('p', { class: 'note is-ok' }, 'Lien par tunnel prêt : il passe par Cloudflare, sans toucher à la box.'));
    if (st.profil && /Public/i.test(st.profil) && D.etat === 'ouvert' && !D.partagee) parts.push(el('p', { class: 'note is-bad' }, 'Windows considère votre réseau comme « public » : le pare-feu y bloque les connexions qui arrivent. Paramètres > Réseau et Internet > votre Wi-Fi ou Ethernet > Type de profil réseau : Privé. Le lien par tunnel, lui, n\'est pas concerné.'));
    // le tunnel : proposé dès que le lien direct n'est pas sûr
    const tunnelUseful = D.etat === 'echec' || (D.etat === 'ouvert' && (D.partagee || D.verifie !== true));
    if (T.etat === 'non' && tunnelUseful) {
      parts.push(el('button', { type: 'button', class: 'btn sn-go' + (D.etat === 'echec' || D.partagee ? ' primary' : ''), onclick: () => act('tunnel') }, 'Créer un lien par tunnel'),
        el('p', { class: 'note' }, 'Passe par Cloudflare (gratuit, sans compte) : marche avec toutes les box, sans réglage ni pare-feu. La première fois, le programme cloudflared (environ 40 Mo) est téléchargé depuis sa page officielle sur GitHub. L\'adresse change à chaque lancement.'));
    } else if (T.etat === 'telechargement') parts.push(el('p', { class: 'note sn-wait' }, `Téléchargement de cloudflared… ${T.pct || 0} %`));
    else if (T.etat === 'demarrage') parts.push(el('p', { class: 'note sn-wait' }, 'Ouverture du tunnel chez Cloudflare…'));
    else if (T.etat === 'echec') parts.push(el('p', { class: 'note is-bad' }, 'Le tunnel n\'a pas pu s\'ouvrir : ' + T.why + '.'), el('button', { type: 'button', class: 'btn small', onclick: () => act('tunnel') }, 'Réessayer le tunnel'));
    // ce que le simulateur a trouvé, et la marche à suivre à la main
    if (D.etat !== 'non' || T.etat !== 'non') {
      const ip = (st.cartes || []).map((c) => `${c.address} (${c.name})`).join(', ') || 'aucune';
      const local = D.local || ((st.cartes || [])[0] || {}).address || '192.168.x.x';
      parts.push(el('details', { class: 'sn-detail' }, el('summary', {}, 'Analyse du réseau'),
        line('Cet ordinateur', ip),
        line('Box', D.box || (D.etat === 'echec' ? 'pas de réponse UPnP' : '…')),
        line('Adresse publique', D.publique || D.wan || '…'),
        line('Port', D.extPort ? `${D.extPort} (TCP) ouvert vers ${D.local}:${D.port}` : `${st.port} (TCP), non ouvert`),
        line('Tunnel', T.etat === 'pret' ? T.url : T.etat === 'non' ? 'non utilisé' : T.etat),
        el('p', { class: 'note' }, `Ouvrir la box à la main : dans l'interface de la box (souvent http://192.168.1.1, ou mafreebox.freebox.fr), créez une redirection de port TCP ${st.port} vers ${local}, port ${st.port}. Le lien est alors http://<adresse publique>:${st.port}/?cle=${st.cle}`)),
      el('button', { type: 'button', class: 'linkbtn', onclick: () => act('fermer') }, 'Fermer l\'accès par Internet'));
    }
    box.replaceChildren(...parts);
  }
  async function poll() {
    if (!box.isConnected && timer) { clearInterval(timer); return; }
    const r = await internetStatus(); if (!r) return;
    st = r; draw();
  }
  poll(); timer = setInterval(poll, 1500);
  return box;
}
// archive du serveur réseau local (assemblée par lankit.js)
async function lanKit() {
  const r = await downloadLanKit();
  if (r === 'unavailable') toast('Archive indisponible ici : le serveur réseau local est fourni avec les sources du simulateur (dossier lan, ou dist/car-regie-serveur-lan.mjs).', 'bad', 7000);
  else if (r === 'error') toast('Le téléchargement n\'a pas abouti : réessayez.', 'bad');
}
const lanKitRow = () => el('div', { class: 'ses-kit' },
  el('div', {}, el('b', {}, 'Jouer sur un réseau local, sans Internet'), el('p', { class: 'note' }, 'La personne qui héberge télécharge le serveur (Windows, macOS, Linux : Node.js nécessaire), le lance, et donne aux autres l\'adresse qu\'il affiche.')),
  el('button', { class: 'btn small', onclick: () => lanKit() }, 'Télécharger le serveur réseau local (.zip)'));
// le salon de coopération, comme le lobby d'un jeu en ligne : à gauche la connexion (l'adresse ou
// le code à donner aux autres, le pseudo, créer ou rejoindre), à droite les postes de la
// prestation, chacun avec la personne qui le tient ou « libre »
function drawJoin(body) {
  const lan = transportKind() === 'lan';
  let role = SES.role !== 'observateur' ? SES.role : (canConfigure() && !lan ? 'formateur' : 'truquiste');
  let mode = 'join', party = null, parties = [], chose = false, polled = false, lastK = '';
  const pseudo = el('input', { type: 'text', value: getPseudo(), maxlength: 24, placeholder: 'Ex. Alice', class: 'ses-pseudo', id: 'ses-pseudo', autocomplete: 'nickname' });
  const code = el('input', { type: 'text', value: SES.code || randomCode(), maxlength: 12, class: 'ses-code', 'aria-label': 'Code de la partie' });
  for (const i of [pseudo, code]) i.addEventListener('keydown', (e) => e.stopPropagation());
  pseudo.addEventListener('input', () => draw());
  const camSel = selectEl([...Array(16).keys()].map((i) => [i + 1, 'CAM ' + (i + 1)]), SES.cam || 1, () => draw(), null, 'Caméra');
  const cards = el('div', { class: 'ses-roles sl-slots', role: 'group', 'aria-label': 'Les postes de la prestation' });
  const camRow = el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Caméra'), camSel);
  const count = el('span', { class: 'sl-count' });
  const taken = () => (mode === 'join' && party ? party.players : []);
  function draw() {
    cards.innerHTML = '';
    const me = pseudo.value.trim() || 'vous';
    for (const [k, r] of Object.entries(ROLES_S)) {
      const who = taken().filter((p) => p.role === k && (k !== 'cadreur' || +p.cam === +camSel.value)).map((p) => p.name);
      const mine = k === role;
      const names = [...who, ...(mine ? [me + ' (vous)'] : [])];
      cards.append(el('button', { type: 'button', class: 'ses-role sl-slot' + (mine ? ' on' : '') + (who.length ? ' taken' : ''), style: { '--rc': ROLE_COLORS[k] }, 'aria-pressed': String(mine), onclick: () => { role = k; draw(); } },
        el('b', {}, r.label),
        el('span', { class: 'sl-who' + (names.length ? '' : ' free') }, names.length ? names.join(', ') : 'Libre'),
        el('small', {}, r.desc),
        who.length ? el('em', {}, (k === 'cadreur' ? 'CAM ' + camSel.value + ' tenue par ' : 'Déjà pris par ') + who.join(', ') + (r.slices.length ? ' : vous seriez en lecture seule' : '')) : null));
    }
    camRow.hidden = role !== 'cadreur';
    const n = taken().length;
    count.textContent = mode === 'join' && party ? `${n} joueur${n > 1 ? 's' : ''} dans la partie` : mode === 'host' ? 'Vous ouvrez le salon' : '';
  }
  // parties du réseau local
  const list = el('div', { class: 'ses-parties' });
  function drawParties() {
    list.innerHTML = '';
    if (!parties.length) { list.append(el('p', { class: 'note' }, 'Aucune partie pour l\'instant. Demandez à l\'hôte de créer la sienne (« Créer une partie ») : la liste se met à jour toute seule.')); return; }
    for (const p of parties) {
      const sel = party && party.code === p.code;
      list.append(el('button', { type: 'button', class: 'ses-party' + (sel ? ' on' : ''), 'aria-pressed': String(!!sel), onclick: () => { party = p; drawParties(); draw(); } },
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
  const tabs = el('div', { class: 'tabs sl-tabs' });
  const pane = el('div', { class: 'list' });
  // ce qu'il faut donner aux autres pour se connecter : sur l'ordinateur de l'hôte, l'adresse de sa carte
  // réseau (pas « localhost », qui ne mène qu'à soi-même) ; par Internet, rien à redonner
  const copy = copyBtn;
  const viaNet = !!internetKey(), host = onHostMachine();
  let addr = `http://${location.host}`;
  const addrEl = el('code', { class: 'sl-addr' }, addr);
  if (lan && host) internetStatus().then((st) => { const c = st && (st.cartes || [])[0]; if (c) { addr = `http://${c.address}:${st.port}`; addrEl.textContent = addr; } });
  const info = lan && viaNet
    ? el('div', { class: 'sl-info lan' }, el('span', { class: 'sl-k' }, 'Par Internet'),
      el('p', { class: 'note' }, 'Vous êtes sur la partie de l\'hôte, ouverte par son lien. Choisissez votre pseudo et votre poste, puis « Rejoindre la partie ».'))
    : lan
    ? el('div', { class: 'sl-info lan' }, el('span', { class: 'sl-k' }, 'Adresse du salon (même réseau)'), addrEl, copy(() => addr, 'Adresse'),
      el('p', { class: 'note' }, 'Les autres joueurs, sur le même réseau (Wi-Fi ou câble), ouvrent cette adresse dans leur navigateur. Rien à installer.'))
    : el('div', { class: 'sl-info' }, el('span', { class: 'sl-k' }, 'Code du salon'), code, copy(() => code.value, 'Code'),
      el('p', { class: 'note' }, 'Tout le monde ouvre la même page publiée sur claude.ai et entre ce code : même code, même car.'));
  function show(m) {
    mode = m; [...tabs.children].forEach((b) => { b.classList.toggle('on', b.dataset.k === m); b.setAttribute('aria-pressed', String(b.dataset.k === m)); });
    pane.innerHTML = '';
    if (m === 'host') pane.append(el('p', { class: 'note' }, lan ? 'Votre ordinateur fait tourner le match pour tout le monde. Les autres verront votre partie dans « Rejoindre une partie ».' : 'Vous faites tourner le match. Donnez le code ci-dessus aux autres joueurs.'),
      ...(lan ? [] : [el('button', { type: 'button', class: 'linkbtn', onclick: () => { code.value = randomCode(); } }, 'Tirer un nouveau code')]));
    else if (lan) pane.append(el('div', { class: 'hwrow' }, el('b', {}, viaNet ? 'Parties de l\'hôte' : 'Parties sur ce réseau'), srvName), list, ...(viaNet ? [] : [linkJoin()]));
    else pane.append(el('p', { class: 'note' }, 'Entrez ci-dessus le code que l\'hôte vous a donné.'));
    goBtn.textContent = m === 'host' ? 'Créer la partie' : 'Rejoindre la partie';
    draw();
  }
  for (const [k, l] of [['host', 'Créer une partie'], ['join', 'Rejoindre une partie']]) tabs.append(el('button', { type: 'button', class: 'tab', 'data-k': k, onclick: () => { chose = true; show(k); } }, l));
  const goBtn = el('button', { class: 'btn primary sl-go' }, 'Rejoindre la partie');
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
    if (!r.ok) { toast(r.why === 'not_permitted' ? 'Accès refusé : demandez au formateur de vous partager la page au niveau Contributeur.' : r.why === 'unreachable' ? 'Serveur réseau local injoignable : vérifiez qu\'il tourne toujours sur l\'ordinateur de l\'hôte.' : r.why === 'full' ? 'Partie complète : rejoignez-en une autre ou demandez à l\'hôte d\'en créer une.' : 'Impossible de rejoindre la partie (' + r.why + ') : réessayez dans un instant.', 'bad', 7000); return; }
    clearInterval(timer); resetRoleStats();
    modal.close();
    if (S.mode === 'start' && startCb) await startCb.start();
    toast(mode === 'host' ? (lan ? `Partie créée. Les autres la rejoignent depuis ${addr} (ou par le lien Internet), « Rejoindre une partie ».` : `Partie ${r.code} créée : donnez ce code aux autres joueurs.`) : `Vous êtes ${ROLES_S[role].label}${role === 'cadreur' ? ' (CAM ' + camSel.value + ')' : ''}.`, 'good', 7000);
  };
  body.append(el('div', { class: 'salon' },
    el('section', { class: 'sl-conn', 'aria-label': 'Connexion' },
      el('div', { class: 'ses-banner' + (lan ? ' lan' : '') }, el('b', {}, lan ? (viaNet ? 'Par Internet' : 'Réseau local') : 'En ligne'), el('span', {}, lan ? 'Servi par l\'ordinateur de l\'hôte' : 'Page publiée sur claude.ai')),
      info,
      el('label', { class: 'sl-k', for: 'ses-pseudo' }, 'Votre pseudo'), pseudo,
      tabs, pane, goBtn,
      ...(lan && host ? [internetBox()] : [])),
    el('section', { class: 'sl-room', 'aria-label': 'Les postes' },
      el('div', { class: 'sl-head' }, el('h3', {}, 'Les postes de la prestation'), count),
      cards, camRow,
      el('p', { class: 'note' }, 'Choisissez votre poste. Chacun n\'est piloté que par celui qui le tient ; les autres le voient en direct, en lecture seule. L\'hôte (ou le formateur) peut réattribuer les postes une fois la partie lancée.'))),
  ...(lan ? [] : [lanKitRow()]));
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
  const title = SES.transport === 'lan' ? `Partie de ${SES.hostPeer ? pseudoOf(SES.hostPeer) : '…'} · ${internetKey() ? 'par Internet' : 'réseau local'}` : 'Partie ' + SES.code;
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
  if (SES.transport === 'lan' && onHostMachine()) box.append(el('div', { class: 'ses-net-wrap' }, internetBox()));
  const tb = el('tbody');
  for (const p of SES.peers) {
    const r = (p.presence && p.presence.role) || 'observateur';
    const owned = Object.keys(SLICES).filter((id) => SES.owners[id] === p.peer);
    let assign = null;
    if (canAssign()) {
      // attribution en cours : on garde le choix affiché le temps que la présence du joueur suive
      const pend = PENDING.get(p.peer); const fresh = pend && Date.now() - pend.at < 10000 && (pend.role !== r || (r === 'cadreur' && +pend.cam !== +((p.presence && p.presence.cam) || 0)));
      const r0 = fresh ? pend.role : r, c0 = fresh && pend.cam ? pend.cam : (p.presence && p.presence.cam) || 1;
      const camS = selectEl([...Array(16).keys()].map((i) => [i + 1, 'CAM ' + (i + 1)]), c0, (v) => { if (roleS.value === 'cadreur') { PENDING.set(p.peer, { role: 'cadreur', cam: +v, at: Date.now() }); assignRole(p.peer, 'cadreur', +v); } }, null, 'Caméra de ' + nameOf(p));
      const roleS = selectEl(Object.entries(ROLES_S).map(([k, x]) => [k, x.label]), r0, (v) => { camS.hidden = v !== 'cadreur'; PENDING.set(p.peer, { role: v, cam: v === 'cadreur' ? +camS.value : null, at: Date.now() }); assignRole(p.peer, v, v === 'cadreur' ? +camS.value : null); }, null, 'Rôle de ' + nameOf(p));
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
  const pseudoIn = el('input', { type: 'text', value: getPseudo(), maxlength: 24, 'aria-label': 'Mon pseudo', style: { width: '160px' } });
  pseudoIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { setPseudo(pseudoIn.value); toast('Pseudo changé.'); } });
  const roleSel = selectEl(Object.entries(ROLES_S).map(([k, r]) => [k, r.label]), SES.role, (v) => { setRole(v, v === 'cadreur' ? (SES.cam || 1) : null); }, null, 'Mon rôle');
  box.append(el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, ...heads.map((h) => el('th', {}, h)))), tb),
    el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Mon pseudo'), pseudoIn, el('button', { class: 'btn small', onclick: () => { setPseudo(pseudoIn.value); toast('Pseudo changé.'); } }, 'Changer le pseudo'), el('span', { class: 'rl' }, 'Mon rôle'), roleSel),
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
  const inp = el('input', { type: 'text', maxlength: 300, placeholder: 'Message à tous (intercom)', 'aria-label': 'Message à tous', style: { flex: '1' } });
  const sendMsg = () => { if (!inp.value.trim()) return; chat(inp.value.trim()); inp.value = ''; };
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') sendMsg(); });
  box.append(el('div', { class: 'hwrow' }, inp, el('button', { class: 'btn primary small', onclick: sendMsg }, 'Envoyer le message')),
    el('p', { class: 'note' }, 'Le réalisateur donne ses ordres depuis son poste (boutons « Prépare », « Top », « Enchaîne »…) : ils s\'affichent en grand chez le truquiste et l\'opérateur ralentis.'), feed);
}

// ---------------- formateur ----------------
function tabTrainer(box) {
  const ok = FAULTS.filter((f) => !f.net && f.can());
  const sel = selectEl(ok.map((f) => [f.id, `${f.label} (${f.where})`]), ok[0] && ok[0].id, () => {}, null, 'Panne à injecter');
  const hidden = el('input', { type: 'checkbox', checked: true, id: 'ses-hid' });
  const note = el('input', { type: 'text', maxlength: 300, placeholder: 'Annonce à tous (ex. « On prend l\'antenne dans 2 minutes »)', 'aria-label': 'Annonce à tous', style: { flex: '1' } });
  note.addEventListener('keydown', (e) => e.stopPropagation());
  const act = el('tbody');
  for (const a of ACTIVE.filter((x) => x.session)) act.append(el('tr', {}, el('td', {}, a.f.label), el('td', {}, a.f.where), el('td', { class: a.done ? 'ok' : 'err' }, a.done ? `résolue en ${Math.round(a.dt)} s` : 'en cours')));
  box.append(el('p', { class: 'note' }, 'La panne est injectée chez le stagiaire qui tient le poste concerné (et chez tous). Les pannes du réseau IP ne sont pas proposées en session.'),
    el('div', { class: 'hwrow' }, sel, el('label', { for: 'ses-hid', class: 'hwrow' }, hidden, 'Panne cachée'), el('button', { class: 'btn primary', onclick: () => trainerInject(sel.value, hidden.checked) }, 'Injecter la panne')),
    el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, el('th', {}, 'Panne'), el('th', {}, 'Où'), el('th', {}, 'État'))), act),
    el('div', { class: 'hwrow' }, note, el('button', { class: 'btn small', onclick: () => { if (note.value.trim()) { announce(note.value.trim()); note.value = ''; } } }, 'Annoncer')),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn', onclick: () => downloadReport() }, 'Télécharger le compte rendu (HTML)'), el('button', { class: 'btn primary', onclick: async () => { const r = await finishIfTrainer(true); toast(r && r.ok ? (r.file ? `Compte rendu enregistré sur l'ordinateur de l'hôte : ${r.file}.html` : 'Compte rendu enregistré (Espace formateur → Stagiaires).') : 'Compte rendu non enregistré (' + ((r && (r.message || r.code)) || 'indisponible') + ') : téléchargez-le en HTML pour le garder.', r && r.ok ? 'good' : 'bad', 7000); } }, 'Enregistrer le compte rendu')));
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
    let done;
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
  const txt = `● ${SES.transport === 'lan' ? (internetKey() ? 'Par Internet' : 'Réseau local') : 'Session ' + SES.code} · ${ROLES_S[SES.role].label}${SES.role === 'cadreur' && SES.cam ? ' CAM ' + SES.cam : ''} · ${SES.peers.length} en ligne · hôte : ${host}`;
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
    const x = /** @type {HTMLElement} */ (e.target); if (!x || !x.closest) return;
    if (!x.closest('.st-body') || x.closest('.tabs, .vx-tabs, .tab, .vx-tab, .net-tabs, [data-ro-ok]')) return;
    if (t === 'keydown' && /** @type {KeyboardEvent} */ (e).code === 'Escape') return;
    e.preventDefault(); e.stopPropagation();
    if (t === 'pointerdown' && performance.now() - lockToastT > 2500) { lockToastT = performance.now(); toast('Poste en lecture seule : pour le piloter, prenez son rôle (bouton « Équipe »).'); }
  }, { capture: true, passive: false });
}
// le réalisateur en session : ses ordres partent vers le truquiste humain s'il y en a un
export function humanTruquiste() { const p = holderOf('mix'); return p && !p.sameTab && p.presence && p.presence.role === 'truquiste' ? p : null; }
export function directorOrder(kind, n) {
  const label = n ? sourceLabel(meSource(n)).replace('CAM ', '') : '';
  sendOrder(kind, { n, label });
}
