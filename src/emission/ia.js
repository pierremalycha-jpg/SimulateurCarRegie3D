// @ts-check
import { S, on } from '../state.js';
import { M } from '../match.js';
import { TEAMS } from '../data/match.js';
import { MIX, meSource, mixSetPst, mixCut, mixAuto, dskToggle, ftbToggle, EVS, evsAction, canalMedias, sourceLabel } from '../pipeline.js';
import { mixInputs } from '../equip.js';
import { GFX, gfxTake, gfxOut } from '../gfx.js';
import { AU, applyAll } from '../audio.js';
import { intercom } from '../ui/common.js';
import { SES, holderOf, isHost, pseudoOf } from '../multi/session.js';
import { SEGMENTS, segmentDe } from './conducteur.js';
import { MEDIAS } from './medias.js';
import { EMI, mediaCharge, prochainTop, sourceMedias } from './etat.js';

// ----------------------------------------------------------------------------------
// L'équipe virtuelle : en solo (ou quand un rôle n'a pas de titulaire en coopération), les postes que
// personne n'occupe sont tenus par une « IA » qui suit le conducteur de l'émission, comme le ferait
// une équipe de car : le réalisateur choisit les plans et demande les ralentis, le truquiste exécute
// ses ordres (avec un temps de réaction), l'IPDirector charge et lance les médias au top, le son baisse
// les ambiances sous les médias et ouvre les commentateurs, l'habillage envoie titre, statistiques et
// bandeaux, la vision suit l'exposition, la scripte annonce les tops dans l'intercom.
// Le poste où l'on est assis (et en coopération, ceux des autres stagiaires) n'est jamais touché :
// le réalisateur virtuel donne alors ses ordres par l'intercom, et attend qu'on les exécute.
// ----------------------------------------------------------------------------------

/** @typedef {{ id: string, poste: string, nom: string, tranche?: string }} RoleIA */
/** @type {RoleIA[]} */
export const ROLES_IA = [
  { id: 'realisateur', poste: 'realisateur', nom: 'Réalisation' },
  { id: 'scripte', poste: 'scripte', nom: 'Scripte' },
  { id: 'truquiste', poste: 'melangeur', nom: 'Truquiste', tranche: 'mix' },
  { id: 'ralentis', poste: 'evs', nom: 'Ralentis (EVS / LSM)', tranche: 'evs' },
  { id: 'ipdirector', poste: 'ipdirector', nom: 'IPDirector, médias', tranche: 'evs' },
  { id: 'son', poste: 'son', nom: 'Son', tranche: 'audio' },
  { id: 'vision', poste: 'vision', nom: 'Vision', tranche: 'cams' },
  { id: 'habillage', poste: 'habillage', nom: 'Habillage', tranche: 'gfx' },
];
const ROLE = Object.fromEntries(ROLES_IA.map((r) => [r.id, r]));
/**
 * Qui tient ce rôle : 'vous' (le poste où l'on est assis), le pseudo d'un participant, ou '' (l'équipe virtuelle).
 * @param {string} id
 */
export function titulaire(id) {
  const r = ROLE[id]; if (!r) return '';
  if (S.mode === 'station' && S.station === r.poste) return 'vous';
  if (SES.active) {
    if (r.tranche) { const p = holderOf(r.tranche); if (p && !p.sameTab) return pseudoOf(p); }
    const p = SES.peers.find((x) => !x.sameTab && x.presence && (x.presence.role === id || (x.presence.av && x.presence.av.s === r.poste)));
    if (p) return pseudoOf(p);
  }
  return '';
}
/** l'équipe virtuelle travaille ici (en coopération, seulement chez l'hôte : il fait tourner le match) */
export const iaActive = () => !SES.active || isHost();

const IA = {
  file: /** @type {{ at: number, kind: string, n?: number, on?: boolean, dire?: string }[]} */ ([]),
  plan: /** @type {{ src: string, until: number, large: boolean } | null} */ (null),
  seq: /** @type {{ step: string, t: number, why: string, onAir?: number } | null} */ (null),
  but: /** @type {{ t: number, scorer: number } | null} */ (null),
  tir: 0, ralentiAfter: 0, lower: 0, gOut: 0,
  dit: /** @type {Record<string, boolean>} */ ({}),
  attente: /** @type {{ src: string, t: number } | null} */ (null),
  ordres: 0, faits: 0, reaction: 0,
};
export const IA_STATS = IA;
export function resetIA() { Object.assign(IA, { file: [], plan: null, seq: null, but: null, tir: 0, ralentiAfter: 0, lower: 0, gOut: 0, dit: {}, attente: null, ordres: 0, faits: 0, reaction: 0 }); }
let DT = 0.016;

// ---------------- sources et caméras ----------------
const meIndex = (src) => { for (let n = 1; n <= mixInputs(); n++) if (meSource(n) === src) return n; return null; };
const camsOk = () => S.cams.filter((c) => c.signalOK !== false && c.status && c.status.ok && !c.paint.bars && meIndex('CAM' + c.id));
const parRole = (roles, f = null) => camsOk().filter((c) => roles.includes(c.role) && (!f || f(c)));
const pos = (c) => c.cam.position;
const camLarge = () => parRole(['large'])[0] || parRole(['tactique'])[0] || parRole(['semi'], (c) => pos(c).z < 0)[0] || camsOk()[0] || null;
const camSemi = (x) => parRole(['semi'], (c) => pos(c).z < 0 && Math.sign(pos(c).x) === Math.sign(x || 1))[0] || null;
const camSerre = () => parRole(['serre'], (c) => pos(c).y > 5)[0] || parRole(['serre'])[0] || null;
const camJoueur = () => parRole(['joueur'])[0] || camSerre();
const camBancs = () => parRole(['bancs'])[0] || camJoueur();
const src = (c) => (c ? 'CAM' + c.id : null);

// ---------------- dire et ordonner ----------------
function dire(qui, txt, kind = '') { intercom(qui, txt, kind); }
/** une annonce une seule fois (clé) */
function annonce(cle, qui, txt, kind = '') { if (IA.dit[cle]) return; IA.dit[cle] = true; dire(qui, txt, kind); }
const nom = (s) => (s && s.startsWith('CAM') ? 'la ' + s.slice(3) : s === 'EVSA' ? 'l\'EVS A' : s === 'EVSB' ? 'l\'EVS B' : sourceLabel(s));
/**
 * Un ordre du réalisateur au truquiste : exécuté par le truquiste virtuel (temps de réaction de 0,2 à 0,5 s),
 * ou dit dans l'intercom quand le poste du mélangeur est tenu (par soi ou un stagiaire).
 * @param {string} kind prep, cut, mix, stinger, dsk1, dsk2, ftb
 * @param {{ src?: string, on?: boolean, dans?: number, dire?: string, reaction?: number }} [o]
 */
function ordre(kind, o = {}) {
  const n = o.src ? meIndex(o.src) : undefined;
  if (o.src && !n) return;
  const at = S.time + (o.dans || 0);
  if (titulaire('truquiste')) {
    const txt = o.dire || { prep: `Prépare ${nom(o.src)}…`, cut: 'Top !', mix: 'Enchaîne !', stinger: 'Volet logo, envoie !', dsk1: o.on ? 'Envoie le score.' : 'Enlève le score.', dsk2: o.on ? 'DSK 2 pour l\'habillage.' : 'Enlève le DSK 2.', ftb: 'Fondu au noir !' }[kind];
    IA.file.push({ at, kind: 'dire', dire: txt });
    if (kind !== 'prep') IA.ordres++;
    return;
  }
  IA.file.push({ at: at + (o.reaction ?? 0.2 + Math.random() * 0.3), kind, n: n || undefined, on: o.on });
  if (o.dire) IA.file.push({ at, kind: 'dire', dire: o.dire });
}
function executer(x) {
  switch (x.kind) {
    case 'dire': dire('RÉAL', /** @type {string} */ (x.dire)); break;
    case 'prep': if (x.n && MIX.pgm !== x.n && MIX.pst !== x.n) mixSetPst(x.n); break;
    case 'cut': if (!MIX.auto) mixCut(); break;
    case 'mix': if (!MIX.auto) { MIX.trans = 'mix'; mixAuto(); } break;
    case 'stinger': if (!MIX.auto) { MIX.trans = 'stinger'; mixAuto(); } break;
    case 'dsk1': if (MIX.dsk1.on !== !!x.on) dskToggle(1, true); break;
    case 'dsk2': if (MIX.dsk2.on !== !!x.on) dskToggle(2, false); break;
    case 'ftb': if (MIX.ftb.on !== !!x.on) ftbToggle(); break;
    default: break;
  }
}
/** passer à l'antenne sur une source : préparer, puis couper (ou enchaîner) */
function passerSur(s, trans = 'cut', o = {}) {
  if (!s || meSource(MIX.pgm) === s || IA.file.some((x) => x.kind !== 'dire')) return false;
  const truq = !!titulaire('truquiste');
  if (truq) {
    // un stagiaire au mélangeur : on annonce, on laisse le temps de préparer, puis le top ; on attend l'exécution
    if (IA.attente && S.time - IA.attente.t < 6) return false;
    ordre('prep', { src: s, dire: o.prep });
    ordre(trans, { dans: o.annonce ?? 1.4, dire: o.top });
    IA.attente = { src: s, t: S.time };
    return true;
  }
  const r = 0.2 + Math.random() * 0.3;
  ordre('prep', { src: s, reaction: r });
  ordre(trans, { dans: o.delai ?? 0.35, dire: o.top, reaction: r });
  return true;
}
/** un ordre donné une seule fois (clé) : le truquiste virtuel l'exécute, un stagiaire l'entend une fois */
function ordreUneFois(cle, kind, o = {}) { if (IA.dit[cle]) return; IA.dit[cle] = true; ordre(kind, o); }

// ---------------- les rôles ----------------
function realisateur(seg, pr) {
  if (titulaire('realisateur')) return;
  const now = S.time, pgm = meSource(MIX.pgm), med = sourceMedias(), m = mediaCharge();
  const L = src(camLarge());
  // le stagiaire au mélangeur a exécuté l'ordre attendu : temps de réaction
  if (IA.attente && pgm === IA.attente.src) { IA.faits++; IA.reaction += now - IA.attente.t; IA.attente = null; }
  switch (seg.id) {
    case 'attente':
      if (pgm === med && !(m && m.playing)) passerSur(L);
      if (pr && pr.dans != null && pr.dans <= 12 && MIX.pst !== meIndex(med)) ordreUneFois('prep:attente', 'prep', { src: med, dire: 'Générique dans 10 secondes. Prépare l\'EVS ' + (med === 'EVSB' ? 'B' : 'A') + ', le générique.' });
      if (MIX.dsk1.on) ordreUneFois('dsk1:attente', 'dsk1', { on: false });
      break;
    case 'generique': case 'pub': case 'generiqueFin': {
      const M_ = MEDIAS[/** @type {string} */ (seg.media)];
      const lance = EMI.C.lance[seg.id] != null;
      if (MIX.dsk1.on) ordreUneFois('dsk1:' + seg.id, 'dsk1', { on: false });
      // au top : on prend le média à l'antenne (lancé ou pas : un média oublié se voit, figé sur sa première image)
      if (pgm !== med && EMI.C.t < 2 && !(m && m.pos >= M_.duree - 2) && !IA.dit['top:' + seg.id]) { if (passerSur(med, 'cut', { top: `Top ${M_.nom.toLowerCase()} !`, annonce: 0.1, delai: 0.15 })) IA.dit['top:' + seg.id] = true; }
      // fin du média : le retour au stade, en fondu (sauf le générique de fin : fondu au noir)
      if (lance && m && m.id === seg.media) {
        const reste = M_.duree - m.pos;
        if (seg.id !== 'generiqueFin') {
          if (reste < 3.5 && MIX.pst !== meIndex(L) && pgm === med) ordreUneFois('prepRetour:' + seg.id, 'prep', { src: L, dire: `Retour stade : prépare ${nom(L)}, plan large.` });
          if (reste < 0.9 && pgm === med && !IA.dit['retour:' + seg.id]) { IA.dit['retour:' + seg.id] = true; ordre('mix', { dire: 'Enchaîne sur le stade !' }); }
        } else if (reste < 1.2 && !MIX.ftb.on && !IA.dit.ftb) { IA.dit.ftb = true; ordre('ftb', { on: true }); }
      }
      break;
    }
    case 'presentation': case 'reprise': case 'mitemps': case 'finmatch': {
      if (pgm === med && !MIX.auto) passerSur(L, 'mix');
      const t = EMI.C.t;
      // un plan de joueur pendant la présentation, puis le large pour le coup d'envoi
      if (seg.id === 'presentation' && t > 6 && t < 10 && !IA.dit.prJoueur) { IA.dit.prJoueur = true; passerSur(src(camJoueur())); }
      if (seg.id === 'presentation' && t > 10.5 && pgm !== L && !IA.dit.prLarge) { IA.dit.prLarge = true; passerSur(L); }
      if (seg.id === 'reprise' && t > 2 && !MIX.dsk1.on) ordreUneFois('dsk1:reprise', 'dsk1', { on: true });
      if ((seg.id === 'mitemps' || seg.id === 'finmatch') && pr && pr.dans != null && pr.dans <= 6) {
        if (MIX.dsk1.on) ordreUneFois('dsk1:' + seg.id, 'dsk1', { on: false });
        if (MIX.pst !== meIndex(med) && pgm !== med) ordreUneFois('prep:' + seg.id, 'prep', { src: med, dire: `${seg.id === 'mitemps' ? 'Pub' : 'Générique de fin'} dans 5 secondes : prépare l'EVS ${med === 'EVSB' ? 'B' : 'A'}.` });
      }
      if (seg.id === 'finmatch' && t > 1 && t < 6 && !IA.dit.finJoueurs) { IA.dit.finJoueurs = true; passerSur(src(camBancs())); }
      if (seg.id === 'finmatch' && t > 6.5 && !IA.dit.finLarge) { IA.dit.finLarge = true; passerSur(L); }
      break;
    }
    case 'mt1': case 'mt2':
      if (pgm === med && !MIX.auto && (!m || !m.playing)) passerSur(L);
      if (M.state !== 'pregame' && !MIX.dsk1.on && pgm !== med) ordreUneFois('score:' + seg.id, 'dsk1', { on: true });
      realiserLeJeu(now, L);
      break;
    default: break;
  }
}
// pendant le jeu : le plan large comme base, des serrés quand l'action le demande, les ralentis
function realiserLeJeu(now, L) {
  const pgm = meSource(MIX.pgm);
  if (M.state === 'break' || M.state === 'pregame') { if (pgm !== L) passerSur(L); return; }
  // ralenti en cours
  if (IA.seq) { ralenti(now, L); return; }
  // un ordre en cours d'exécution (truquiste virtuel), ou attendu d'un stagiaire au mélangeur
  if (IA.file.some((x) => x.kind !== 'dire') || (IA.attente && now - IA.attente.t < 6)) return;
  // après un but : le buteur, la joie, puis le ralenti
  if (IA.but) {
    const dt = now - IA.but.t;
    if (dt > 0.8 && dt < 4 && !IA.dit['but1:' + IA.but.t]) { IA.dit['but1:' + IA.but.t] = true; passerSur(src(camSerre())); }
    if (dt > 4.5 && dt < 7 && !IA.dit['but2:' + IA.but.t]) { IA.dit['but2:' + IA.but.t] = true; passerSur(src(camJoueur())); }
    if (dt > 7.5) { IA.but = null; demarrerRalenti(now, 'but'); }
    return;
  }
  if (IA.ralentiAfter && now > IA.ralentiAfter) { IA.ralentiAfter = 0; if (Math.random() < 0.5) { demarrerRalenti(now, 'action'); return; } }
  // bandeau du buteur, après le ralenti du but
  if (IA.lower && now > IA.lower) { IA.lower = 0; habillageBandeau(); }
  if (IA.plan && now < IA.plan.until && pgm === IA.plan.src) return;
  if (IA.file.some((x) => x.kind !== 'dire') || MIX.auto) return;
  // choix du plan suivant
  const b = M.ball, r = Math.random();
  let next = null;
  if (IA.plan && !IA.plan.large) next = { src: L, until: now + 6 + Math.random() * 7, large: true };
  else if (Math.abs(b.x) > 33 && r < 0.45) { const c = camSemi(b.x); if (c) next = { src: src(c), until: now + 4 + Math.random() * 2.5, large: false }; }
  else if (r < 0.62 && M.owner >= 0) { const c = camSerre(); if (c) next = { src: src(c), until: now + 2.5 + Math.random() * 1.5, large: false }; }
  else if (r < 0.7) { const c = camJoueur(); if (c) next = { src: src(c), until: now + 2.5 + Math.random() * 1.5, large: false }; }
  if (!next) next = { src: L, until: now + 7 + Math.random() * 7, large: true };
  IA.plan = next;
  if (pgm !== next.src) passerSur(next.src);
}
function demarrerRalenti(now, why) {
  const a = EVS.ch[0];
  // le canal A doit être calé sur l'action (opérateur ralentis), et pas occupé par un média
  if (a.media) return;
  if (titulaire('ralentis') && !IA.dit['evsDemande:' + now.toFixed(0)]) { IA.dit['evsDemande:' + now.toFixed(0)] = true; dire('RÉAL', 'EVS A, ralenti de l\'action !'); }
  IA.seq = { step: 'attend', t: now, why };
}
function ralenti(now, L) {
  const q = /** @type {{ step: string, t: number, why: string, onAir?: number }} */ (IA.seq); const a = EVS.ch[0]; const pgm = meSource(MIX.pgm);
  const pret = a.mode === 'pause' && a.in != null && !a.media;
  if (q.step === 'attend') {
    if (pret) { passerSur('EVSA', 'stinger', { prep: 'Ralenti : prépare l\'EVS A.', top: 'Ralenti, volet logo !', annonce: 1.2, delai: 0.9 }); q.step = 'air'; q.t = now; }
    else if (now - q.t > 5) IA.seq = null; // pas de ralenti prêt : tant pis
    return;
  }
  if (q.step === 'air') {
    if (pgm === 'EVSA' && !q.onAir) q.onAir = now;
    const fini = q.onAir && ((a.mode === 'pause' && !a.playing && now - q.onAir > 2.5) || a.mode === 'live' || now - q.onAir > 16 || (M.state === 'play' && Math.abs(M.ball.x) > 32 && now - q.onAir > 5));
    if (fini || (!q.onAir && now - q.t > 8)) { passerSur(L, 'stinger', { prep: `Retour au direct : prépare ${nom(L)}.`, top: 'Retour, volet logo !', annonce: 1, delai: 0.5 }); q.step = 'retour'; q.t = now; }
    return;
  }
  if (q.step === 'retour' && (pgm !== 'EVSA' || now - q.t > 6)) { if (q.why === 'but') IA.lower = now + 3; IA.seq = null; IA.plan = { src: L, until: now + 7, large: true }; }
}

function ipdirector(seg, pr) {
  if (titulaire('ipdirector')) return;
  const ch = canalMedias(); const c = EVS.ch[ch]; const m = c.media;
  const onAir = meSource(MIX.pgm) === sourceMedias();
  // le prochain média au conducteur, pas encore lancé
  const k = SEGMENTS.findIndex((s, i) => i >= EMI.C.i && s.media && EMI.C.lance[s.id] == null && !EMI.C.manque[s.id]);
  const next = k >= 0 ? SEGMENTS[k] : null;
  // un média fini qui n'est plus à l'antenne : on rend le canal (en UHD, c'est aussi le canal des ralentis)
  if (m && !m.playing && m.pos >= MEDIAS[m.id].duree - 0.05 && !onAir && (!next || next.media !== m.id)) { evsAction(ch, 'mediaeject'); return; }
  if (!next) return;
  const avantTop = k === EMI.C.i ? 0 : k === EMI.C.i + 1 && pr && pr.dans != null ? pr.dans : Infinity;
  // charger (cue) le prochain média quand le canal est libre, au plus tard 30 s avant son top
  if ((!m || (m.id !== next.media && !(onAir && m.playing))) && (seg.id === 'attente' || avantTop <= 30)) { evsAction(ch, 'media', { id: next.media, by: 'ia' }); return; }
  // au top : on le lance
  if (k === EMI.C.i && m && m.id === next.media && !m.playing && EMI.C.t >= 0.12) evsAction(ch, 'mediaplay', 'ia');
}

const VCA_CIBLE = { amb: 0, canon: 0, comm: 0 };
function son(seg) {
  if (titulaire('son')) return;
  const med = meSource(MIX.pgm) === sourceMedias() && !!mediaCharge();
  const avant = seg.id === 'attente', fin = seg.id === 'fin';
  // sous un média : ambiances en fond, canons et commentaires fermés ; avant l'antenne : commentateurs fermés
  VCA_CIBLE.amb = fin ? -60 : med ? -22 : 0;
  VCA_CIBLE.canon = fin || med ? -40 : 0;
  VCA_CIBLE.comm = fin || med || avant ? -60 : 0;
  let chg = false;
  for (const k of /** @type {('amb' | 'canon' | 'comm')[]} */ (['amb', 'canon', 'comm'])) {
    const v = AU.vca[k]; const cible = VCA_CIBLE[k];
    if (Math.abs(v.fader - cible) > 0.05) { const pas = 30 * DT; v.fader = Math.abs(cible - v.fader) <= pas ? cible : v.fader + Math.sign(cible - v.fader) * pas; chg = true; }
  }
  // le fader du canal de diffusion de l'EVS : 0 dB pour un média (livré au bon niveau), −6 dB pour les ralentis
  const evs = AU.ch[canalMedias() ? 'evsB' : 'evsA'];
  if (evs) { const cible = med ? 0 : -6; if (Math.abs(evs.fader - cible) > 0.05) { const pas = 20 * DT; evs.fader = Math.abs(cible - evs.fader) <= pas ? cible : evs.fader + Math.sign(cible - evs.fader) * pas; chg = true; } }
  if (chg) applyAll();
}
function habillage(seg) {
  if (titulaire('habillage')) return;
  const t = EMI.C.t;
  const sortir = (dur) => { if (GFX.template && GFX.anim > 0.9 && t > dur) gfxOut(); };
  if (!MIX.dsk2.on) { if (!titulaire('truquiste')) { if (!IA.file.some((x) => x.kind === 'dsk2')) ordre('dsk2', { on: true }); } else annonce('dsk2', 'HABILLAGE', 'Truquiste, le DSK 2 pour l\'habillage, s\'il te plaît.'); }
  if (seg.id === 'presentation') {
    if (t > 1.5 && !IA.dit.gTitre) { IA.dit.gTitre = true; GFX.title = `${TEAMS[0].name} – ${TEAMS[1].name}`; GFX.subtitle = 'Championnat · Journée 12 · Stade Bollaert-Delelis'; gfxTake('titre'); }
    sortir(7.5);
  }
  if (seg.id === 'mitemps' || seg.id === 'finmatch') {
    if (t > 1.5 && !IA.dit['gStats:' + seg.id]) { IA.dit['gStats:' + seg.id] = true; gfxTake('stats'); }
    sortir(seg.id === 'mitemps' ? 7 : 9);
  }
  // pas de graphique sur un média
  if (seg.media && GFX.template && GFX.anim > 0.5 && GFX.animDir >= 0) gfxOut();
}
function habillageBandeau() {
  if (titulaire('habillage') || M.scorer < 0) return;
  GFX.player = M.scorer; gfxTake('lower'); IA.gOut = S.time + 5;
}
let visionT = 0;
function vision(dt) {
  if (titulaire('vision')) return;
  visionT += dt; if (visionT < 1) return; visionT = 0;
  // le suivi de l'exposition (« riding ») : un iris qui s'écarte de la cible est ramené doucement
  for (const c of S.cams) {
    if (!c.signalOK || c.paint.autoIris || c.paint.bars || !(c.meter && c.meter.mean > 0.05)) continue;
    const m = c.meter.mean;
    if (m < 0.34 || m > 0.58) c.paint.iris = Math.max(1.4, Math.min(22, Math.round(c.paint.iris * Math.pow(m / 0.45, 0.35) * 10) / 10));
  }
}
const ann = (s) => String(Math.ceil(s));
function scripte(seg, pr) {
  if (!pr) return;
  const d = pr.dans;
  const k = seg.id;
  if (k === 'attente' && d != null) {
    if (d <= 60.5 && d > 59) annonce('a60', 'SCRIPTE', 'Antenne dans 1 minute.');
    if (d <= 30.5 && d > 29) annonce('a30', 'SCRIPTE', `Antenne dans 30 secondes. Générique ${mediaCharge() && mediaCharge().id === 'gen-debut' ? 'chargé' : 'à charger'} à l'IPDirector.`, mediaCharge() ? '' : 'bad');
    if (d <= 10.5 && d > 9) annonce('a10', 'SCRIPTE', 'Antenne dans 10 secondes…');
    for (const n of [5, 4, 3, 2, 1]) if (d <= n + 0.05 && d > n - 0.9) annonce('a' + n, 'SCRIPTE', ann(n) + '…');
  }
  if (seg.media) {
    const lance = EMI.C.lance[k] != null;
    if (!lance && EMI.C.t > 2.5) annonce('oubli1:' + k, 'SCRIPTE', `IPDirector, le ${MEDIAS[/** @type {string} */ (seg.media)].nom.toLowerCase()} ! On l'attend à l'antenne !`, 'bad');
    if (!lance && EMI.C.t > 8) annonce('oubli2:' + k, 'RÉAL', `Toujours pas de ${MEDIAS[/** @type {string} */ (seg.media)].nom.toLowerCase()} : lance-le !`, 'bad');
    if (lance && d != null) {
      if (k === 'pub' && d <= 30.5 && d > 29) annonce('p30', 'SCRIPTE', 'Retour dans 30 secondes.');
      if (d <= 10.5 && d > 9) annonce('m10:' + k, 'SCRIPTE', k === 'pub' ? 'Retour dans 10 secondes.' : k === 'generiqueFin' ? 'Fin d\'antenne dans 10 secondes.' : 'Fin du générique dans 10 secondes.');
      if (k !== 'generiqueFin') for (const n of [3, 2, 1]) if (d <= n + 0.05 && d > n - 0.9) annonce(`m${n}:${k}`, 'SCRIPTE', ann(n) + '…');
    }
  }
  if ((k === 'presentation' || k === 'reprise') && d != null && d <= 10.5 && d > 9) annonce('ko:' + k, 'SCRIPTE', 'Coup d\'envoi dans 10 secondes.');
  if ((k === 'mt1' || k === 'mt2') && d != null && d <= 60.5 && d > 58) annonce('fin60:' + k, 'SCRIPTE', k === 'mt1' ? 'Mi-temps dans 1 minute. Pub à la mi-temps.' : 'Dernière minute de jeu.');
  if ((k === 'mitemps' || k === 'finmatch') && d != null) for (const n of [5, 4, 3, 2, 1]) if (d <= n + 0.05 && d > n - 0.9) annonce(`t${n}:${k}`, 'SCRIPTE', ann(n) + '…');
}
/** l'équipe virtuelle, à chaque image */
export function updateIA(dt) {
  if (!EMI.on || EMI.suivi || !iaActive()) return;
  DT = dt;
  const now = S.time;
  // la file d'ordres du truquiste virtuel (et les phrases du réalisateur)
  if (IA.file.length) { IA.file.sort((a, b) => a.at - b.at); while (IA.file.length && IA.file[0].at <= now) executer(/** @type {any} */ (IA.file.shift())); }
  const seg = segmentDe(EMI.C), pr = prochainTop();
  scripte(seg, pr);
  ipdirector(seg, pr);
  realisateur(seg, pr);
  son(seg);
  habillage(seg);
  vision(dt);
  if (IA.gOut && now > IA.gOut) { IA.gOut = 0; if (!titulaire('habillage')) gfxOut(); }
  // qui tient quoi (générique de fin, compte rendu)
  for (const r of ROLES_IA) { const q = titulaire(r.id) || 'ia'; EMI.qui[r.id] = q; const key = r.id + '\u0000' + q; EMI.postes[key] = (EMI.postes[key] || 0) + dt; }
}
/** une séquence commence : ce que l'équipe virtuelle dit au top */
export function segmentIA(id) {
  if (!iaActive()) return;
  const seg = SEGMENTS.find((s) => s.id === id); if (!seg) return;
  if (id === 'mt1' || id === 'mt2') IA.plan = null;
  if (id === 'fin') IA.file = [];
}
on('match', (e) => {
  if (!EMI.on || !e) return;
  if (e.type === 'goal') { IA.but = { t: S.time, scorer: e.scorer }; IA.seq = null; IA.ralentiAfter = 0; }
  if (e.type === 'shot' || e.type === 'save') IA.tir = S.time;
  if (e.type === 'out' && (e.kind === 'goalkick' || e.kind === 'corner') && S.time - IA.tir < 4 && !IA.seq && !IA.but) IA.ralentiAfter = S.time + 1.5;
});
