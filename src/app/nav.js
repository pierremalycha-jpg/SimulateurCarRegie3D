// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { $, modal, ask } from '../ui/common.js';
import { icon } from '../ui/icons.js';
import { closeLayer, layerSay } from '../ui/layer.js';
import { openCours } from '../ui/cours/espace.js';
import { openEntrainement } from '../ui/entrainement.js';
import { beginLesson } from '../ui/tutor_ui.js';
import { hasStation, closeStation } from '../ui/stations.js';
import { closePlan } from '../ui/plan.js';
import { netGo } from '../ui/st_network.js';
import { openTrainer } from '../ui/config.js';
import { openReglages, openCommandes } from '../ui/guide.js';
import { openSessionPanel } from '../ui/session_ui.js';
import { openDiag } from '../ui/diag_ui.js';
import { AU, startAudio, applyFaders } from '../audio.js';
import { saveProgressSoon } from '../shared.js';
import { SES } from '../multi/session.js';
import { resetFabric } from '../net/fabric.js';
import { releaseCamera } from './camop.js';
import { TITLE, titleOpen, enterFrom } from './title.js';
import { launch } from './start.js';

// ----------------------------------------------------------------------------------
// La navigation entre les quatre espaces, les mêmes depuis l'écran titre et dans le car : Jouer
// (la feuille de service, puis le car), Cours, S'entraîner, Espace formateur. Ici : le menu du
// car (Échap, bouton « Menu ») et l'aiguillage des boutons des espaces (« Emmène-moi »,
// « Commencer », « Lancer ») : le car est lancé s'il ne l'est pas encore, puis on va au parcours,
// au poste ou à la vacation demandés.
// ----------------------------------------------------------------------------------
const PRESET_NAME = { standard: 'le car prêt à l\'antenne', vierge: 'l\'installation du car', atelier: 'l\'atelier de montage', brassage: 'le car vide', scenario: 'le jour de match', grand: 'le grand dispositif' };
const NEXT_KEY = 'carregie.next';

/**
 * @typedef {object} Target
 * @property {string} [label] libellé du bouton
 * @property {string} [lesson] parcours du chef de car
 * @property {string} [station] poste à ouvrir
 * @property {string} [tab] onglet du poste
 * @property {string} [preset] vacation à lancer
 * @property {boolean} [ip] demande le car IP
 */
/** @param {Target} g */
async function go(g) {
  if (!g) return;
  if (g.preset) { await play(g.preset); return; }
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
 * demandée. La progression est enregistrée avant (enregistrement différé de 2,5 s).
 * @param {string} [preset]
 */
export async function restart(preset = '') {
  const what = preset ? `Lancer ${PRESET_NAME[preset] || preset} ?` : 'Revenir à l\'accueil ?';
  const ok = await ask(`${what}\n\nLa partie en cours s'arrête et le simulateur se recharge, le temps de reconstruire le stade. Ta progression est enregistrée.${SES.active ? '\n\nTu quittes aussi la partie à plusieurs.' : ''}`,
    { title: preset ? 'Changer de vacation' : 'Retour à l\'accueil', ok: preset ? 'Relancer le simulateur' : 'Revenir à l\'accueil', cancel: 'Continuer la partie' });
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
/** après un « Changer de vacation » : la vacation demandée se lance dès que le car est prêt */
export function resumeAfterReload() {
  let preset = ''; try { preset = sessionStorage.getItem(NEXT_KEY) || ''; sessionStorage.removeItem(NEXT_KEY); } catch (e) { /* rien à reprendre */ }
  if (!preset || !PRESET_NAME[preset] || !TITLE.ready) return;
  enterFrom('start');
  launch(preset);
}

// ---------------- le menu du car (Échap, bouton « Menu ») ----------------
const soundOn = () => !AU.muted;
/** le menu de la partie : reprendre, les espaces, les réglages et les outils, revenir à l'accueil */
export function openMenu() {
  if (S.mode === 'start') return;
  const then = (fn) => () => { modal.close(); fn(); };
  /** @param {string} id @param {string} ico @param {string} label @param {string} sub @param {() => void} fn @param {{ kbd?: string, primary?: boolean, pressed?: boolean }} [o] */
  const key = (id, ico, label, sub, fn, o = {}) => el('button', { type: 'button', class: 'ti-key mn-key' + (o.primary ? ' primary' : ''), id, 'aria-pressed': o.pressed == null ? null : String(o.pressed), onclick: fn },
    icon(ico), el('b', {}, label), el('small', {}, sub), o.kbd ? el('kbd', {}, o.kbd) : null);
  const son = () => key('mn-son', soundOn() ? 'son' : 'muet', 'Son', soundOn() ? 'Ambiance et commentaires : en service' : 'Coupé', () => {
    startAudio(); AU.muted = !AU.muted; applyFaders(); emit('soundToggle');
    $('#mn-son')?.replaceWith(son());
  }, { pressed: soundOn() });
  const body = el('div', { class: 'mn' },
    el('section', { class: 'mn-col', 'aria-label': 'La partie et les espaces' },
      key('mn-resume', 'reprendre', 'Reprendre', 'Revenir au car', () => modal.close(), { primary: true, kbd: 'Échap' }),
      key('mn-cours', 'cours', 'Cours', 'Les notions techniques, les chapitres, le glossaire', then(() => openCours()), { kbd: 'G' }),
      key('mn-train', 'entrainement', 'S\'entraîner', 'Parcours du chef, exercices notés, livret de compétences', then(() => openEntrainement())),
      key('mn-trainer', 'formateur', 'Espace formateur', 'Configuration du car, suivi des stagiaires, relecture', then(() => openTrainer('car')))),
    el('section', { class: 'mn-col', 'aria-label': 'Réglages et outils' },
      key('mn-reglages', 'reglages', 'Réglages', 'Lumière, qualité graphique, affichage', then(openReglages)),
      key('mn-commandes', 'commandes', 'Commandes', 'Toutes les touches du clavier', then(openCommandes), { kbd: 'H' }),
      son(),
      key('mn-equipe', 'equipe', 'Équipe', 'Jouer à plusieurs : joueurs, rôles, ordres', then(openSessionPanel)),
      key('mn-diag', 'diagnostic', 'Diagnostic technique', 'Pour signaler un problème', then(openDiag)),
      key('mn-home', 'accueil', 'Retour à l\'accueil', 'Quitter la partie, revenir à l\'écran titre', then(() => restart()))));
  modal.open('Menu', body, { width: 760 });
  if (!matchMedia('(pointer: coarse)').matches) /** @type {HTMLElement} */ (body.querySelector('#mn-resume')).focus({ preventScroll: true });
}
on('menu', () => openMenu());
