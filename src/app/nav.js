// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { modal, ask } from '../ui/common.js';
import { icon } from '../ui/icons.js';
import { closeLayer, layerSay } from '../ui/layer.js';
import { openCours } from '../ui/cours_ui.js';
import { beginLesson } from '../ui/tutor_ui.js';
import { hasStation, closeStation } from '../ui/stations.js';
import { closePlan } from '../ui/plan.js';
import { netGo } from '../ui/st_network.js';
import { openSessionPanel } from '../ui/session_ui.js';
import { saveProgressSoon } from '../shared.js';
import { SES } from '../multi/session.js';
import { resetFabric } from '../net/fabric.js';
import { releaseCamera } from './camop.js';
import { TITLE, titleOpen, enterFrom } from './title.js';
import { launch } from './start.js';
import { livePlayerCard } from '../game/quest.js';

// ----------------------------------------------------------------------------------
// La navigation entre les trois entrées, les mêmes depuis l'écran titre et dans le car : Jouer
// (la feuille de service, puis le car), Cours (leçons et leurs exercices pratiques), Réglages
// (avec l'espace formateur pour le profil Formateur). Ici : le menu du car (Échap, bouton
// « Menu ») et l'aiguillage des boutons du Cours (« Commencer », « Emmène-moi ») : le car est
// lancé s'il ne l'est pas encore, puis on va à l'exercice, au poste ou à la vacation demandés.
// ----------------------------------------------------------------------------------
const PRESET_NAME = { standard: 'le car prêt à l\'antenne', vierge: 'l\'installation du car', atelier: 'l\'atelier de montage', brassage: 'le car vide', scenario: 'le jour de match', grand: 'le grand dispositif' };
/** après le rechargement : le bureau de l'entrepôt en mode Carrière (src/carriere/) */
const CARRIERE = 'carriere';
const NEXT_KEY = 'carregie.next';

/**
 * @typedef {object} Target
 * @property {string} [label] libellé du bouton
 * @property {string} [lesson] parcours du chef de car
 * @property {string} [station] poste à ouvrir
 * @property {string} [tab] onglet du poste
 * @property {string} [preset] vacation à lancer
 * @property {boolean} [ip] demande le car IP
 * @property {string} [camera] le module « La caméra en 3D » ('mes' : sur l'exercice Mise en service)
 * @property {string} [entrepot] le module L'entrepôt, sur cette mission ('' : bac à sable)
 */
/** @param {Target} g */
async function go(g) {
  if (!g) return;
  if (g.preset) { await play(g.preset); return; }
  // le module caméra s'ouvre par-dessus tout, sans le car ; en sortant, retour à la leçon d'où l'on vient
  // l'entrepôt aussi : un mode à part, sans le car
  if (g.entrepot !== undefined) { closeLayer(false); const lesson = S.coursBack || ''; S.coursBack = null; emit('entrepot', { mission: g.entrepot || '', lesson }); return; }
  if (g.camera) { closeLayer(false); const lesson = S.coursBack || undefined; S.coursBack = null; emit('camera', { from: 'cours', mes: g.camera === 'mes', lesson }); return; }
  if (!leaveTitle()) return;
  if (g.lesson) { closeLayer(false); await beginLesson(g.lesson); return; }
  if (!g.station || !hasStation(g.station)) return;
  if (S.mode === 'start') { closeLayer(false); launch('standard', { ip: g.ip }); if (S.mode === 'start') return; }
  else if (g.ip && !S.ipMode) {
    if (!(await ask('Ce poste demande le car IP (ST 2110). Passer le car en IP maintenant ? Les signaux passent alors par les deux réseaux rouge et bleu au lieu de la grille SDI.', { title: 'Car IP', ok: 'Passer en IP' }))) return;
    S.ipMode = true; resetFabric(); emit('router', {});
  }
  closeLayer(false);
  openAt(g.station, g.tab);
}
on('go', (g) => { go(g); });

// sur l'écran titre : le quitter pour la feuille de service (false tant que le car se construit)
function leaveTitle() {
  if (!titleOpen()) return true;
  if (!TITLE.ready) { layerSay('Le car se prépare encore : dans quelques secondes, ce bouton t\'y emmènera.'); return false; }
  enterFrom('start');
  return true;
}
// ouvre un poste (et l'un de ses onglets), d'où que l'on soit dans le car
function openAt(id, tab) {
  if (S.mode === 'camop') releaseCamera();
  if (S.mode === 'plan') closePlan();
  if (S.mode === 'station' && S.station !== id) closeStation(true);
  if (!(S.mode === 'station' && S.station === id)) emit('openStationNow', { id });
  if (!tab) return;
  setTimeout(() => {
    if (id === 'reseau') { netGo(tab); return; }
    const b = /** @type {HTMLElement | null} */ (document.querySelector(`#station .tabs > .tab[data-k="${tab}"]`)); if (b) b.click();
  }, 80);
}
// une vacation : lancée depuis la feuille de service ; en cours de partie, le simulateur repart
async function play(preset) {
  if (S.mode !== 'start') { await restart(preset); return; }
  if (!leaveTitle()) return;
  closeLayer(false);
  launch(preset);
}

/**
 * Quitte la partie : le simulateur se recharge sur l'écran titre, ou lance directement la vacation
 * demandée (ou le bureau de l'entrepôt de la Carrière : 'carriere'). La progression est enregistrée
 * avant (enregistrement différé de 2,5 s).
 * @param {string} [preset]
 */
export async function restart(preset = '') {
  const back = preset === CARRIERE;
  const what = back ? 'Retourner au bureau de l\'entrepôt ?' : preset ? `Lancer ${PRESET_NAME[preset] || preset} ?` : 'Revenir à l\'accueil ?';
  const ok = await ask(`${what}\n\nLa partie en cours s'arrête et le simulateur se recharge, le temps de reconstruire le stade. Ta progression est enregistrée.${SES.active ? '\n\nTu quittes aussi la partie à plusieurs.' : ''}`,
    { title: back ? 'Retour à l\'entrepôt' : preset ? 'Changer de vacation' : 'Retour à l\'accueil', ok: back ? 'Retourner à l\'entrepôt' : preset ? 'Relancer le simulateur' : 'Revenir à l\'accueil', cancel: 'Continuer la partie' });
  if (!ok) return;
  closeLayer(false); if (modal.isOpen) modal.close();
  saveProgressSoon();
  try { if (preset) sessionStorage.setItem(NEXT_KEY, preset); else sessionStorage.removeItem(NEXT_KEY); } catch (e) { /* stockage indisponible : retour à l'écran titre */ }
  const msg = el('p', { class: 'plate' }, 'Enregistrement de ta progression, puis retour à l\'accueil…');
  document.body.append(el('div', { id: 'leaving', class: 'overlay' }, msg));
  setTimeout(() => location.reload(), 3200);
  // rechargement refusé (page intégrée) : on le dit
  setTimeout(() => { msg.textContent = 'Le simulateur n\'a pas pu se recharger tout seul : rechargez la page (touche F5).'; }, 9000);
}
/** après un « Changer de vacation » : la vacation demandée se lance dès que le car est prêt (ou le bureau de la Carrière) */
export function resumeAfterReload() {
  let preset = ''; try { preset = sessionStorage.getItem(NEXT_KEY) || ''; sessionStorage.removeItem(NEXT_KEY); } catch (e) { /* rien à reprendre */ }
  if (!preset || !(PRESET_NAME[preset] || preset === CARRIERE) || !TITLE.ready) return;
  enterFrom('start');
  if (preset === CARRIERE) { emit('entrepot', { carriere: true }); return; }
  launch(preset);
}

// ---------------- le menu du car (Échap, bouton « Menu ») ----------------
/** le menu de la partie : reprendre, le Cours, les réglages, l'équipe en coopération, l'accueil */
export function openMenu() {
  if (S.mode === 'start') return;
  const then = (fn) => () => { modal.close(); fn(); };
  /** @param {string} id @param {string} ico @param {string} label @param {string} sub @param {() => void} fn @param {{ kbd?: string, primary?: boolean }} [o] */
  const key = (id, ico, label, sub, fn, o = {}) => el('button', { type: 'button', class: 'ti-key mn-key' + (o.primary ? ' primary' : ''), id, onclick: fn },
    icon(ico), el('b', {}, label), el('small', {}, sub), o.kbd ? el('kbd', {}, o.kbd) : null);
  const body = el('div', { class: 'mn' },
    livePlayerCard(),
    key('mn-resume', 'reprendre', 'Reprendre', 'Revenir au car', () => modal.close(), { primary: true, kbd: 'Échap' }),
    key('mn-cours', 'cours', 'Cours', 'Les leçons et leurs exercices pratiques, le glossaire, les postes, le matériel', then(() => openCours()), { kbd: 'G' }),
    key('mn-reglages', 'reglages', 'Réglages', 'Qualité, son, lumière, profil, touches, diagnostic', then(() => emit('settings'))),
    SES.active ? key('mn-equipe', 'equipe', 'Équipe', 'Les joueurs de la partie, leurs rôles, les ordres', then(openSessionPanel)) : null,
    key('mn-home', 'accueil', 'Retour à l\'accueil', 'Quitter la partie, revenir à l\'écran titre', then(() => restart())));
  modal.open('Menu', body, { width: 480 });
  if (!matchMedia('(pointer: coarse)').matches) /** @type {HTMLElement} */ (body.querySelector('#mn-resume')).focus({ preventScroll: true });
}
on('menu', () => openMenu());
