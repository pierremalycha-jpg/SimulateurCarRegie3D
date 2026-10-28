// @ts-check
import { S, on, emit } from '../state.js';
import { el, mmss as mmssJeu } from '../util.js';
import { M, avantMatch, coupDEnvoi, matchEnContinu } from '../match.js';
import { TEAMS } from '../data/match.js';
import { MIX, meSource, resolve, EVS, dskToggle, ftbToggle } from '../pipeline.js';
import { mixInputs } from '../equip.js';
import { GFX, gfxOut } from '../gfx.js';
import { AU } from '../audio.js';
import { SPK } from '../commentary.js';
import { $, toast, intercom, modal } from '../ui/common.js';
import { addEmissionResult } from '../shared.js';
import { SES, isFollower, getPseudo, registerSnapExtra } from '../multi/session.js';
import { DUREES, SEGMENTS, nouveauConducteur, avance, antenneMaintenant, suspendre, segmentDe, bilan, SEUIL_EMISSION, setDurees } from './conducteur.js';
import { MEDIAS } from './medias.js';
import { EMI, faitsDuCar, mediaCharge, prochainTop, sourceMedias } from './etat.js';
import { setInfoMedias } from './video.js';
import { sonMedias, silenceMedias, niveauMedia } from './musique.js';
import { updateIA, segmentIA, resetIA, ROLES_IA, IA_STATS } from './ia.js';
import { texteDirect } from './panneau.js';

// ----------------------------------------------------------------------------------
// L'émission en direct (Jouer → Car régie → Car pré-installé → « Émission en direct ») : le match ne
// commence plus tout seul. Un compte à rebours (ou « Antenne maintenant ») mène au top antenne : le
// générique de début (30 s) lancé depuis l'IPDirector, la présentation, une 1re période de 10 minutes,
// la mi-temps et sa page de publicité, la 2e période, le générique de fin, puis le compte rendu noté.
// Le conducteur (conducteur.js) dit où l'on en est ; les postes que personne n'occupe sont tenus par
// l'équipe virtuelle (ia.js) ; l'horloge du direct reste à l'écran, à pied comme assis à un poste.
// ----------------------------------------------------------------------------------
const mmss = (s) => { if (s == null) return '--:--'; const v = Math.max(0, Math.ceil(s)); return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };
const meIndex = (src) => { for (let n = 1; n <= mixInputs(); n++) if (meSource(n) === src) return n; return null; };
// mesures en cours d'émission (compte rendu)
const MES = { air: /** @type {Record<string, number>} */ ({}), retour: /** @type {Record<string, number>} */ ({}), rapportT: 0 };

/** l'émission démarre (ou redémarre) : le match à l'échauffement, le car prêt, le compte à rebours */
export function demarrer() {
  EMI.on = true; EMI.suivi = isFollower();
  EMI.C = nouveauConducteur(); EMI.t0 = 0; EMI.tFin = 0; EMI.rapport = null;
  EMI.J = { medias: {}, noir: 0, score: 0, retours: [] }; EMI.jeu = 0; EMI.jeuScore = 0; EMI.postes = {}; EMI.qui = {}; EMI.finMedia = {};
  Object.assign(MES, { air: {}, retour: {}, rapportT: 0 });
  resetIA();
  if (!EMI.suivi) {
    avantMatch(DUREES.periode);
    // le car prêt pour l'antenne : plan large au programme, score retiré, habillage disponible, pas de fondu au noir
    const large = S.cams.find((c) => c.role === 'large');
    const n = large ? meIndex('CAM' + large.id) : null; if (n) { MIX.pgm = n; MIX.pst = meIndex('CAM' + ((large.id % 12) + 1)) || MIX.pst; }
    if (MIX.dsk1.on) dskToggle(1, false);
    if (!MIX.dsk2.on) dskToggle(2, false);
    if (MIX.ftb.on) ftbToggle();
    if (GFX.template) gfxOut();
    for (const c of EVS.ch) c.media = null;
  }
  setInfoMedias({ equipes: TEAMS, score: [0, 0], credits: generique() });
  construireHorloge();
  intercom('CHEF DE CAR', `Émission en direct : antenne dans ${mmss(DUREES.compte)}. Le générique se lance depuis l'IPDirector ; les postes que tu n'occupes pas sont tenus par l'équipe virtuelle.`, 'ok');
  emit('emission', { type: 'debut' });
}
/** quitter l'émission : le match repart en continu (jeu libre) */
export function quitter() {
  EMI.on = false; silenceMedias();
  if (!isFollower()) { matchEnContinu(); if (MIX.ftb.on) ftbToggle(); if (!MIX.dsk1.on) dskToggle(1, false); }
  const h = $('#direct'); if (h) h.hidden = true;
  emit('emission', { type: 'quitte' });
}

// ---------------- le générique de fin : qui a tenu chaque poste ----------------
function qui(roleId) {
  // le titulaire qui a tenu le poste le plus longtemps (10 s au moins), sinon l'équipe virtuelle ; l'IPDirector : celui
  // qui a lancé le plus de médias
  if (roleId === 'ipdirector') {
    const n = {}; for (const r of Object.values(EMI.J.medias)) if (r && r.par && r.par !== 'ia') n[r.par] = (n[r.par] || 0) + 1;
    const w = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    if (w) return w === 'vous' ? (getPseudo() || 'Vous') : w;
  }
  let best = '', t = 10;
  for (const [k, v] of Object.entries(EMI.postes)) { const [r, w] = k.split('\u0000'); if (r === roleId && w !== 'ia' && v >= t) { best = w; t = v; } }
  return best === 'vous' ? (getPseudo() || 'Vous') : best || 'Équipe virtuelle';
}
function generique() {
  const nCams = S.cams.length;
  return /** @type {[string, string][]} */ ([
    ...ROLES_IA.map((r) => /** @type {[string, string]} */ ([r.nom, qui(r.id)])),
    ['Cadreurs', `${nCams} caméra${nCams > 1 ? 's' : ''}, cadreurs automatiques`],
    ['Commentaires', `${SPK.comm1.name} et ${SPK.comm2.name}`],
    ['Bord terrain', SPK.bt.name],
    ['Chef de car', 'Olivier'],
    ['Production', 'BTS Audiovisuel de Saint-Quentin'],
    ['TIEE Simulator', 'développé par Pierre MALYCHA'],
  ]);
}

// ---------------- la boucle ----------------
let uiAcc = 0;
export function updateEmission(dt) {
  // le son des médias, même hors émission (un générique lancé pour s'entraîner s'entend aussi)
  sonMedias(AU.ctx, [AU.ports ? AU.ports['AES 1'] : null, AU.ports ? AU.ports['AES 2'] : null], EVS.ch.map((c) => c.media));
  if (!EMI.on) return;
  EMI.suivi = isFollower();
  if (!EMI.suivi && !EMI.C.fini) {
    const evs = avance(EMI.C, dt, faitsDuCar());
    for (const e of evs) evenement(e);
    mesurer(dt);
    updateIA(dt);
  }
  // le compte rendu, une fois, trois secondes après la fin d'antenne
  if (EMI.C.fini && EMI.rapport && !MES.rapportT) MES.rapportT = S.time + 3;
  if (MES.rapportT > 0 && S.time >= MES.rapportT) { MES.rapportT = -1; compteRendu(); }
  uiAcc += dt; if (uiAcc > 0.2) { uiAcc = 0; majHorloge(); }
}
function evenement(e) {
  if (e.type === 'lance') {
    const m = mediaCharge(); const seg = SEGMENTS.find((s) => s.id === e.id);
    if (seg && seg.media) EMI.J.medias[seg.media] = { retard: e.retard ?? null, antenne: 0, par: m ? m.by : '' };
    return;
  }
  if (e.type === 'manque') { const seg = SEGMENTS.find((s) => s.id === e.id); if (seg && seg.media) EMI.J.medias[seg.media] = { retard: null, antenne: 0, par: '' }; intercom('RÉAL', 'Le média n\'est pas parti : on enchaîne sans lui.', 'bad'); return; }
  // une nouvelle séquence
  const id = e.id;
  if (id === 'generique') EMI.t0 = S.time;
  if (id === 'mt1' || id === 'mt2') coupDEnvoi();
  if (id === 'finmatch' || id === 'generiqueFin') setInfoMedias({ score: M.score.slice(), credits: generique() });
  if (id === 'fin') finir();
  segmentIA(id);
  annoncer(segmentDe(EMI.C).titre);
  emit('emission', { type: 'segment', id, de: e.de });
}
// ce qui part à l'antenne, pour le compte rendu
function mesurer(dt) {
  const seg = segmentDe(EMI.C); if (!seg.antenne) return;
  const pgm = meSource(MIX.pgm), med = sourceMedias(), m = mediaCharge();
  const surMedia = pgm === med && !!m;
  // image en défaut : noir, mire, perte de signal, fondu au noir, ou un média figé à l'antenne (pas lancé, arrêté)
  const r = resolve(pgm);
  const figé = surMedia && !m.playing && m.pos < MEDIAS[m.id].duree - 0.05;
  if (pgm === 'BLACK' || pgm === 'BARS' || (r.alarm && !['MIRE', 'BARRES'].includes(r.alarm)) || MIX.ftb.level > 0.5 || figé) EMI.J.noir += dt;
  // part de chaque média diffusée
  if (seg.media && surMedia && m.id === seg.media && m.playing) MES.air[m.id] = (MES.air[m.id] || 0) + dt;
  // le retour au stade après le générique de début et après la pub
  if (m && (m.id === 'gen-debut' || m.id === 'pub') && m.pos >= MEDIAS[m.id].duree - 0.05 && EMI.finMedia[m.id] == null) EMI.finMedia[m.id] = S.time;
  for (const id of ['gen-debut', 'pub']) {
    if (MES.retour[id] != null || !EMI.J.medias[id]) continue;
    const fini = EMI.finMedia[id];
    if (pgm && pgm.startsWith('CAM') && (fini != null || (m && m.id === id && MEDIAS[id].duree - m.pos < 3))) MES.retour[id] = fini != null ? Math.max(0, S.time - fini) : 0;
  }
  // le score à l'antenne pendant le jeu
  if ((M.periode === 1 || M.periode === 2) && (M.state === 'play' || M.state === 'restart' || M.state === 'celebration')) {
    EMI.jeu += dt; if (MIX.dsk1.level > 0.5 && !surMedia) EMI.jeuScore += dt;
  }
}
function finir() {
  EMI.tFin = S.time;
  for (const id of ['gen-debut', 'pub', 'gen-fin']) { const r = EMI.J.medias[id]; if (r) r.antenne = Math.min(1, (MES.air[id] || 0) / MEDIAS[id].duree); }
  // un retour jamais fait compte comme manqué
  EMI.J.retours = ['gen-debut', 'pub'].map((id) => MES.retour[id] ?? Infinity);
  EMI.J.score = EMI.jeu > 0 ? EMI.jeuScore / EMI.jeu : 0;
  EMI.rapport = bilan(EMI.J);
  const seul = EMI.rapport.parVous === 3 && !SES.active;
  addEmissionResult({ score: EMI.rapport.score, parVous: EMI.rapport.parVous, seul, postes: ROLES_IA.filter((r) => qui(r.id) !== 'Équipe virtuelle').map((r) => r.id) });
  emit('emission', { type: 'fini', score: EMI.rapport.score, seul, parVous: EMI.rapport.parVous });
  intercom('RÉAL', 'Fin d\'antenne. Merci à tous, belle émission !', 'ok');
}

// ---------------- le compte rendu ----------------
export function compteRendu() {
  const R = EMI.rapport; if (!R) return;
  const ok = R.score >= SEUIL_EMISSION;
  const lignes = R.lignes.map((l) => el('tr', {}, el('td', {}, l.titre), el('td', { class: 'mono' }, `${l.pts} / ${l.max}`), el('td', { class: 'note' }, l.detail)));
  const postes = ROLES_IA.map((r) => el('li', {}, el('b', {}, r.nom), ' : ', qui(r.id)));
  const t = IA_STATS;
  const truq = t.ordres ? el('p', { class: 'note' }, `Au mélangeur : ${t.faits} ordre${t.faits > 1 ? 's' : ''} du réalisateur exécuté${t.faits > 1 ? 's' : ''} sur ${t.ordres}${t.faits ? `, en ${(t.reaction / t.faits).toFixed(1).replace('.', ',')} s en moyenne` : ''}.`) : null;
  const body = el('div', { class: 'list em-rapport' },
    el('div', { class: 'lcd amber big' }, `Émission : ${R.score} / 100`),
    el('p', {}, ok ? 'L\'émission est allée à l\'antenne proprement : génériques et pub au top, retours au stade, score à l\'image.' : 'L\'émission est allée au bout, mais l\'antenne a souffert : reprenez les lignes en dessous de leur maximum.'),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact' }, el('thead', {}, el('tr', {}, el('th', {}, 'Critère'), el('th', {}, 'Points'), el('th', {}, 'Détail'))), el('tbody', {}, ...lignes))),
    el('h3', { class: 'eq-h' }, 'Qui tenait les postes'), el('ul', { class: 'em-qui' }, ...postes), truq,
    el('p', { class: 'note' }, R.parVous === 3 && !SES.active ? 'Les trois médias ont été lancés par vous depuis l\'IPDirector : l\'émission compte dans votre livret (compétence 3.11, mettre en œuvre un conducteur).' : 'Pour que l\'émission compte dans le livret, lancez vous-même les trois médias (générique, pub, générique de fin) depuis l\'IPDirector.'),
    el('div', { class: 'hwrow' },
      el('button', { class: 'btn primary', 'data-k': 'emission:rejouer', onclick: () => { modal.close(); demarrer(); } }, 'Rejouer l\'émission'),
      el('button', { class: 'btn', 'data-k': 'emission:libre', onclick: () => { modal.close(); quitter(); toast('Le match continue, sans conducteur : jeu libre.'); } }, 'Continuer en match libre'),
      el('button', { class: 'btn', onclick: () => modal.close() }, 'Fermer')));
  modal.open('Compte rendu · émission en direct', body, { width: 820 });
}

// ---------------- l'horloge du direct (à l'écran, à pied et aux postes) ----------------
const H = /** @type {{ root: HTMLElement | null, lamp: HTMLElement | null, seg: HTMLElement | null, next: HTMLElement | null, time: HTMLElement | null, cmd: HTMLElement | null, pause: HTMLButtonElement | null, live: HTMLElement | null }} */ ({ root: null, lamp: null, seg: null, next: null, time: null, cmd: null, pause: null, live: null });
function construireHorloge() {
  if (!H.root) {
    H.lamp = el('span', { class: 'dr-lamp', 'aria-hidden': 'true' });
    H.seg = el('b', { class: 'dr-seg' }); H.next = el('span', { class: 'dr-next' }); H.time = el('span', { class: 'dr-time' });
    H.pause = /** @type {HTMLButtonElement} */ (el('button', { type: 'button', class: 'dr-btn', 'data-k': 'direct:pause', onclick: () => emit('emission', { type: 'cmd', cmd: 'pause' }) }, 'Suspendre'));
    H.cmd = el('span', { class: 'dr-cmd' }, el('button', { type: 'button', class: 'dr-btn primary', 'data-k': 'direct:antenne', onclick: () => emit('emission', { type: 'cmd', cmd: 'antenne' }) }, 'Antenne maintenant'), H.pause);
    H.live = el('span', { class: 'sr', 'aria-live': 'polite' });
    H.root = el('div', { id: 'direct', class: 'direct', role: 'group', 'aria-label': 'L\'émission en direct : le conducteur', hidden: true }, H.lamp, H.seg, H.next, H.time, H.cmd, H.live);
    document.body.appendChild(H.root);
  }
  majHorloge();
}
function annoncer(txt) { if (H.live) H.live.textContent = txt; }
function majHorloge() {
  const r = H.root; if (!r) return;
  const T = texteDirect();
  const voir = !!T && S.mode !== 'start' && S.mode !== 'plan';
  if (r.hidden === voir) r.hidden = !voir;
  if (!T) return;
  // assis à un poste : l'horloge se range dans l'en-tête du poste ; à pied, sous la barre d'outils
  const tete = S.mode === 'station' ? $('#station .st-head') : null;
  if (tete && r.parentElement !== tete) { tete.insertBefore(r, tete.querySelector('.st-tools')); r.classList.add('in-head'); }
  else if (!tete && r.parentElement !== document.body) { document.body.appendChild(r); r.classList.remove('in-head'); }
  r.classList.toggle('air', T.antenne);
  r.classList.toggle('attend', T.dans === 'à lancer');
  /** @type {HTMLElement} */ (H.seg).textContent = T.antenne ? `À L'ANTENNE · ${T.seg}` : T.seg;
  /** @type {HTMLElement} */ (H.next).textContent = T.prochain ? T.prochain : '';
  const jeu = (M.periode === 1 || M.periode === 2) ? `  ·  ${TEAMS[0].short} ${M.score[0]}-${M.score[1]} ${TEAMS[1].short}  ${mmssJeu(M.clock)}` : '';
  /** @type {HTMLElement} */ (H.time).textContent = (T.dans || '') + jeu;
  const att = segmentDe(EMI.C).type === 'compte' && !EMI.suivi;
  /** @type {HTMLElement} */ (H.cmd).hidden = !att;
  /** @type {HTMLButtonElement} */ (H.pause).textContent = EMI.C.suspendu ? 'Reprendre' : 'Suspendre';
}

// ---------------- commandes, session, installation ----------------
on('emission', (e) => {
  if (!e || e.type !== 'cmd' || !EMI.on) return;
  if (EMI.suivi && e.cmd !== 'rapport') return;
  if (e.cmd === 'antenne') { antenneMaintenant(EMI.C); intercom('SCRIPTE', 'On prend l\'antenne tout de suite !'); }
  if (e.cmd === 'pause') { const v = suspendre(EMI.C); intercom('SCRIPTE', v ? 'Décompte suspendu : on attend.' : 'Décompte repris.'); }
  if (e.cmd === 'rapport') compteRendu();
  majHorloge();
});
// le lancement d'une partie : le car pré-installé en « Émission en direct »
on('started', () => { if (S.emission && S.modeCar === 'libre') setTimeout(() => demarrer(), 400); else if (EMI.on) quitter(); });
/** l'émission est installée par main.js : l'hôte d'une session partage son conducteur avec les autres */
export function installEmission() {
  registerSnapExtra('em', () => (EMI.on ? { i: EMI.C.i, t: Math.round(EMI.C.t * 10) / 10, c: Math.round(EMI.C.compte * 10) / 10, s: EMI.C.suspendu ? 1 : 0, l: EMI.C.lance, f: EMI.C.fini ? 1 : 0, r: EMI.rapport } : null), (v) => {
    if (!v) { if (EMI.on && EMI.suivi) quitter(); return; }
    if (!EMI.on) demarrer();
    Object.assign(EMI.C, { i: v.i, t: v.t, compte: v.c, suspendu: !!v.s, lance: v.l || {}, fini: !!v.f });
    if (v.r && !EMI.rapport) EMI.rapport = v.r;
  });
}
/** tests : aller tout de suite à la fin de la séquence en cours (décompte, média ou période presque finis) */
function sauter() {
  const seg = segmentDe(EMI.C);
  if (seg.type === 'compte') antenneMaintenant(EMI.C);
  else if (seg.type === 'duree') EMI.C.t = Math.max(EMI.C.t, DUREES[/** @type {'presentation'} */ (seg.cle)] - 0.05);
  else if (seg.type === 'media') { const m = mediaCharge(); if (m && m.id === seg.media && EMI.C.lance[seg.id] != null) m.pos = Math.max(m.pos, MEDIAS[m.id].duree - 1.2); }
  else if (seg.type === 'periode') M.clock = Math.max(M.clock, (seg.periode === 1 ? 1 : 2) * M.dureePeriode - 0.3);
  return seg.id;
}
/** pour les tests de bout en bout */
export const emissionDebug = () => ({ EMI, DUREES, setDurees, prochain: prochainTop(), seg: segmentDe(EMI.C).id, demarrer, quitter, compteRendu, sauter, niveauMedia, ia: IA_STATS });
