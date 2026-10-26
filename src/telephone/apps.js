// @ts-check
import { S, emit } from '../state.js';
import { el } from '../util.js';
import { $ } from '../ui/common.js';
import { icon } from '../ui/icons.js';
import { T } from '../truck.js';
import { STATION_INFO } from '../content/stations.js';
import { AU, startAudio, applyFaders } from '../audio.js';
import { avatarPositions } from '../multi/avatars.js';
import { SES } from '../multi/session.js';
import { DESTS, teleport, goToStation, goToMate } from '../app/teleport.js';
import { PL, updToolbar } from '../app/player.js';
import { whereAmI } from '../app/hud.js';
import { planFor } from '../ui/truckmap.js';
import { openPlan } from '../ui/plan.js';
import { openSynoptics } from '../ui/synoptics.js';
import { openCommandes } from '../ui/guide.js';
import { openSessionPanel } from '../ui/session_ui.js';
import { openEquipmentIndex } from '../equipment/viewer.js';
import { openCours } from '../ui/cours_ui.js';
import { openLivret } from '../ui/livret.js';
import { closeStation } from '../ui/stations.js';
import { currentGoal, playerCard } from '../game/quest.js';
import { xpOf, levelOf, badgesWon } from '../game/xp.js';
import { TUTOR, lessonsFor, lessonBlocked } from '../tutor/engine.js';
import { closeTelephone } from './index.js';

// ----------------------------------------------------------------------------------
// Les applications du téléphone, rangées dans les trois familles des menus (décision v19) : le
// car (aller à, missions, Olivier, plan, synoptiques, matériel, équipe), le Cours (leçons,
// glossaire, postes, progression), les réglages (réglages, commandes), plus trois interrupteurs
// (son, vol libre, retour PGM). Une application a soit une vue sur l'écran du téléphone (view),
// soit une fenêtre à ouvrir (open) une fois le téléphone rangé.
// ----------------------------------------------------------------------------------
const ZONE_NAME = { son: 'Cabine son', prod: 'Production', vision: 'Vision et ralentis', tech: 'Technique' };
// noms courts des endroits hors du car (DESTS garde les noms longs pour les autres menus)
const OUT_NAME = ['Devant le car', null, null, null, null, 'Bord terrain', 'Sortie du tunnel', 'Tunnel et vestiaires', 'Passerelle caméras', 'Derrière le but', 'Kop Marek', 'Angle et pylône', 'Toit (antennes HF)', 'Vue aérienne'];
const OUT_ICON = ['car', null, null, null, null, 'terrain', 'tunnel', 'vestiaires', 'passerelle', 'but', 'kop', 'pylone', 'toit', 'aerien'];
// icône de chaque poste du car (ui/icons.js), à côté de son nom
const STATION_ICON = { son: 'mixage', scripte: 'scripte', realisateur: 'realisateur', melangeur: 'melangeur', habillage: 'habillage', producteur: 'producteur', chefdecar: 'chef', vision1: 'vision', vision2: 'vision', evsA: 'evs', evsB: 'ipdirector', ccu: 'ccu', grille: 'grille', xvsrack: 'processeur', reseau: 'reseau', evsrack: 'serveur', transmission: 'transmission', synchro: 'synchro', intercom: 'intercom', mvproc: 'brassage', audiorack: 'audio', hf: 'hf', mesure: 'mesure' };

const libre = () => S.modeCar === 'libre';
const station = () => (S.mode === 'station' ? S.station : null);

/**
 * @typedef {{ id: string, name: string, ico: string, hue: number, fam: 'car' | 'cours' | 'reglages', key?: string, desc: string,
 *   show?: () => boolean, open?: () => void, view?: (box: HTMLElement) => void, cls?: string }} App
 */
/** @type {App[]} */
export const APPS = [
  { id: 'aller', name: 'Aller à', ico: 'boussole', hue: 200, fam: 'car', desc: 'Aller à un poste du car, un endroit du stade, rejoindre un équipier', view: allerView },
  { id: 'missions', name: 'Missions', ico: 'missions', hue: 40, fam: 'car', key: 'L', desc: 'Le journal : ce qu\'il y a à faire ici, toutes les missions, tes badges', show: () => !libre(), open: () => emit('journal') },
  { id: 'olivier', name: 'Olivier', ico: 'chef', hue: 150, fam: 'car', key: 'J', desc: 'Le chef de car : il explique le poste et guide pas à pas', show: () => !libre(), open: () => emit('chef'), cls: 'chef-btn' },
  { id: 'plan', name: 'Plan caméras', ico: 'plan', hue: 110, fam: 'car', key: 'P', desc: 'Le stade vu de haut : installer, déplacer, prendre une caméra', open: () => { if (station()) closeStation(); openPlan(); } },
  { id: 'synoptiques', name: 'Synoptiques', ico: 'synoptiques', hue: 265, fam: 'car', key: 'Y', desc: 'Les schémas du car : vidéo, synchro, audio, réseaux, énergie', open: () => openSynoptics() },
  { id: 'materiel', name: 'Matériel', ico: 'materiel', hue: 20, fam: 'car', key: 'K', desc: 'Les appareils, leurs faces et leurs connecteurs', open: () => openEquipmentIndex() },
  { id: 'equipe', name: 'Équipe', ico: 'equipe', hue: 320, fam: 'car', desc: 'La session à plusieurs : rôles, équipiers', show: () => !!SES.active, open: () => openSessionPanel() },
  { id: 'cours', name: 'Cours', ico: 'cours', hue: 190, fam: 'cours', key: 'G', desc: 'Les leçons (au poste : la leçon du poste)', open: () => (station() ? emit('cours', { poste: station() }) : openCours()) },
  { id: 'glossaire', name: 'Glossaire', ico: 'lexique', hue: 230, fam: 'cours', desc: 'Les mots du métier', open: () => openCours({ tab: 'glossaire' }) },
  { id: 'postes', name: 'Les postes', ico: 'postes', hue: 170, fam: 'cours', desc: 'Les métiers du car, poste par poste', open: () => openCours({ tab: 'postes' }) },
  { id: 'progression', name: 'Progression', ico: 'livret', hue: 50, fam: 'cours', desc: 'Niveau, badges, suivi du Cours, livret de compétences', view: progressionView },
  { id: 'reglages', name: 'Réglages', ico: 'reglages', hue: 210, fam: 'reglages', desc: 'Qualité, son, profil, jeu, ma progression', open: () => emit('settings') },
  { id: 'commandes', name: 'Commandes', ico: 'commandes', hue: 0, fam: 'reglages', key: 'H', desc: 'Toutes les touches du clavier', open: () => openCommandes() },
];
const FAMS = [['car', 'Le car'], ['cours', 'Cours'], ['reglages', 'Réglages']];

/** une icône d'application : carré arrondi de couleur, nom dessous */
function appTile(a, launch) {
  const b = el('button', { type: 'button', class: 'tel-app' + (a.cls ? ' ' + a.cls : ''), 'data-app': a.id, title: a.desc + (a.key ? ` (touche ${a.key})` : ''), style: `--h:${a.hue}`, onclick: () => launch(a.id) },
    el('span', { class: 'tel-ico' }, icon(a.ico)), el('span', { class: 'tel-name' }, a.name));
  if (a.id === 'olivier' && TUTOR.lesson) b.classList.add('busy');
  if (a.id === 'missions') { const n = hereCount(); if (n) b.append(el('i', { class: 'tel-badge', 'aria-label': `${n} à ce poste` }, String(n))); }
  return b;
}
/** nombre d'exercices au poste où l'on est (pastille de l'application Missions) */
function hereCount() {
  const st = station(); if (!st || libre()) return 0;
  return lessonsFor(st).here.filter((l) => !l.id.startsWith('poste-') && !lessonBlocked(l)).length;
}
/** interrupteur rapide (comme le centre de contrôle d'un téléphone) */
function toggle(label, ico, on, fn) {
  const ic = () => icon(typeof ico === 'function' ? ico() : ico);
  const b = el('button', { type: 'button', class: 'tel-tog' + (on() ? ' on' : ''), 'aria-pressed': String(on()), onclick: () => { fn(); b.classList.toggle('on', on()); b.setAttribute('aria-pressed', String(on())); b.querySelector('.ico')?.replaceWith(ic()); } }, ic(), el('span', {}, label));
  return b;
}

/** l'accueil : lieu, objectif, niveau, applications par famille, interrupteurs */
export function homeView(launch) {
  const box = el('div', { class: 'tel-home' });
  const [zone] = whereAmI();
  box.append(el('div', { class: 'tel-where' }, icon('repere'), el('span', {}, zone)));
  const g = currentGoal();
  if (g) {
    const chef = g.kind === 'exercice' || g.kind === 'visite';
    box.append(el('button', { type: 'button', class: 'tel-widget tel-goal', title: chef ? 'Olivier, le chef de car' : 'Le journal des missions', onclick: () => launch(chef ? 'olivier' : 'missions') },
      el('small', {}, icon('objectif'), g.tag || 'Objectif'), el('b', {}, g.title), g.text ? el('span', {}, g.text) : null,
      typeof g.prog === 'number' ? el('i', { class: 'tel-prog' }, el('i', { style: { width: `${Math.round(g.prog * 100)}%` } })) : null));
  }
  box.append(levelWidget(launch));
  for (const [fam, title] of FAMS) {
    const list = APPS.filter((a) => a.fam === fam && (!a.show || a.show()));
    box.append(el('section', { class: 'tel-fam', 'aria-label': title }, el('h3', {}, title), el('div', { class: 'tel-grid' }, ...list.map((a) => appTile(a, launch)))));
  }
  box.append(el('div', { class: 'tel-togs', role: 'group', 'aria-label': 'Raccourcis' },
    toggle('Son', () => (AU.muted ? 'muet' : 'son'), () => !AU.muted, () => { startAudio(); AU.muted = !AU.muted; applyFaders(); emit('soundToggle'); }),
    S.mode === 'fps' && !S.inTruck ? toggle('Vol libre', 'vol', () => PL.fly, () => { PL.fly = !PL.fly; updToolbar(); }) : null,
    toggle('Retour PGM', 'retour', () => { const m = $('#minimon'); return !!m && !m.hidden; }, () => { const m = $('#minimon'); if (m) m.hidden = !m.hidden; })));
  return box;
}
/** le niveau sur une ligne (la carte complète est dans l'application Progression) */
export function levelWidget(launch) {
  const xp = xpOf(), L = levelOf(xp), won = badgesWon().length;
  return el('button', { type: 'button', class: 'tel-widget tel-lvl', title: 'Ma progression', onclick: () => launch('progression') },
    el('b', { class: 'tel-lvl-n' }, String(L.n)), el('span', { class: 'tel-lvl-t' }, el('b', {}, L.title), el('small', {}, `${xp} XP`)),
    el('i', { class: 'tel-prog' }, el('i', { style: { width: `${Math.round(L.pct * 100)}%` } })),
    el('span', { class: 'tel-lvl-b' }, icon('medaille'), String(won)));
}
/** une application ouverte sur l'écran : en-tête avec retour, puis son contenu */
export function appView(a, back) {
  const body = el('div', { class: 'tel-appbody' });
  a.view(body);
  return el('div', { class: 'tel-page', 'data-app': a.id },
    el('header', { class: 'tel-head', style: `--h:${a.hue}` }, el('button', { type: 'button', class: 'tel-back', 'aria-label': 'Retour à l\'accueil du téléphone', onclick: back }, icon('retourapp')), el('h2', {}, a.name)),
    body);
}

const row = (label, ico, fn, o = {}) => el('button', { type: 'button', class: 'tel-row' + (o.on ? ' on' : ''), title: o.title || label, 'aria-current': o.on ? 'true' : null, style: o.color ? `--mate:${o.color}` : null, onclick: fn }, icon(ico || 'suivant'), el('span', {}, label), o.on ? el('small', {}, 'ici') : null);

/** Aller à : le plan du car, les postes par zone, le stade, les équipiers */
function allerView(box) {
  const here = station();
  const [zone, hint] = whereAmI();
  box.append(el('p', { class: 'tel-here' }, el('small', {}, 'Vous êtes ici'), el('b', {}, zone), hint ? el('span', {}, hint) : null));
  const I = T.layout.size;
  const plan = el('div', { class: 'tel-plan', title: 'Un point du plan : aller au poste' }, planFor(292 / (I.x1 - I.x0)));
  // un point du plan emmène au poste (truckmap.js) : le téléphone se range d'abord
  plan.addEventListener('click', () => closeTelephone(true), true);
  plan.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') closeTelephone(true); }, true);
  box.append(plan);
  for (const z of T.layout.zones) {
    const list = T.stations.filter((s) => s.zone === z.id); if (!list.length) continue;
    box.append(el('section', { class: 'tel-sec', style: `--zc:${z.color}` }, el('h3', {}, ZONE_NAME[z.id] || z.name),
      ...list.map((s) => row(s.short || s.label, STATION_ICON[s.id], () => { closeTelephone(true); goToStation(s); }, { on: here === s.station, title: `Aller au poste ${s.label}` }))));
  }
  box.append(el('section', { class: 'tel-sec' }, el('h3', {}, 'Le stade et le compound'),
    ...DESTS.map((d, i) => (d[4] ? null : row(OUT_NAME[i] || d[0], OUT_ICON[i], () => { closeTelephone(true); if (station()) closeStation(); teleport(i); }, { title: d[0] }))).filter(Boolean)));
  const mates = avatarPositions();
  if (mates.length) {
    box.append(el('section', { class: 'tel-sec' }, el('h3', {}, 'Rejoindre un équipier'),
      ...mates.map((a) => row(`${a.name} : ${a.cam ? 'CAM ' + a.cam : a.station ? (STATION_INFO[a.station] ? STATION_INFO[a.station].title : a.station) : a.truck ? 'dans le car' : 'dehors'}`, 'equipier', () => { closeTelephone(true); if (station()) closeStation(); goToMate(a); }, { color: a.color }))));
  }
}

/** Progression : niveau et badges, puis les trois endroits où se lit la progression */
function progressionView(box) {
  box.append(playerCard());
  const go = (fn) => () => { closeTelephone(true); fn(); };
  box.append(el('section', { class: 'tel-sec' }, el('h3', {}, 'Ma progression'),
    libre() ? null : row('Journal des missions et badges', 'medaille', go(() => emit('journal'))),
    row('Mon parcours dans le Cours', 'cours', go(() => openCours({ home: true }))),
    row('Livret de compétences', 'livret', go(() => openLivret()))));
}
