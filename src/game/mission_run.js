// @ts-check
import { S, on, emit } from '../state.js';
import { el } from '../util.js';
import { PROG } from '../shared.js';
import { modal, toast } from '../ui/common.js';
import { MISSIONS } from '../ui/guide.js';
import { patchScore } from '../patch.js';
import { launch } from '../app/start.js';
import { restart } from '../app/nav.js';
import { beginLesson } from '../ui/tutor_ui.js';
import { missionPicker } from '../ui/missions_ui.js';
import { missionById, premiereAFaire, memeCar } from './missions.js';

// ----------------------------------------------------------------------------------
// Le déroulement d'une mission spécifique (Jouer → Car régie → Mission spécifique ; catalogue :
// game/missions.js). Événement « missionCar » :
//   - { type: 'lancer', id } : depuis l'écran Jouer (ou après un rechargement), le car est préparé pour
//     la mission (app/start.js, prepa) puis la tâche commence (exercice d'Olivier, formation réseau…) ;
//   - { type: 'fini', id } : émis ici quand la mission est terminée (bannière : game/fx.js ; le suivi
//     des tâches propose alors « Mission suivante » ou « Arrêter » : game/quest.js) ;
//   - { type: 'suivante' } : la liste des missions pour enchaîner ; si le car convient, sans recharger ;
//   - { type: 'arreter' } : retour à l'accueil.
// Une installation est réussie quand chacune de ses tâches (missions du car vide, ui/guide.js) l'a été
// pendant la partie : les postes ouverts comptent depuis le lancement (RUN.vu), pas depuis toujours.
// ----------------------------------------------------------------------------------
/** @typedef {import('./missions.js').MissionCar} MissionCar */
export const RUN = {
  /** @type {MissionCar | null} */ m: null,
  t0: 0,
  fini: false,
  /** ce qu'on en retient à la fin (le score d'une épreuve…) */ resultat: '',
  /** tâches d'installation réussies depuis le lancement */ got: /** @type {Set<string>} */ (new Set()),
  /** postes ouverts depuis le lancement */ vu: /** @type {Set<string>} */ (new Set()),
};

function commencer(/** @type {MissionCar} */ m) {
  Object.assign(RUN, { m, t0: Date.now(), fini: false, resultat: '' }); RUN.got.clear(); RUN.vu.clear();
  // ce qu'en lisent le chef de car (ui/tutor_ui.js) et le suivi des tâches (game/quest.js), sans importer ce module
  S.mission = { id: m.id, titre: m.titre, resume: m.resume, kind: m.kind, lecon: m.kind === 'olivier' ? m.id : '', taches: [], tache: null, pct: 0, fini: false, resultat: '' };
}
/** lance une mission depuis l'écran Jouer : le car préparé, puis la tâche */
function lancer(/** @type {string} */ id) {
  const m = missionById(id); if (!m) return;
  commencer(m);
  launch(m.prepa.preset, { ip: m.prepa.ip, sdi: m.prepa.sdi, prepa: m.prepa, modeCar: 'mission' });
  if (S.mode === 'start') { RUN.m = null; return; } // le car n'est pas prêt
  demarrerTache(m);
}
/** la tâche elle-même, le car lancé : l'exercice d'Olivier, l'onglet Formation du poste Réseau IP */
function demarrerTache(/** @type {MissionCar} */ m) {
  if (m.kind === 'olivier') setTimeout(() => beginLesson(m.id), 200);
  else if (m.id === 'x-reseau') setTimeout(() => emit('go', { station: 'reseau', tab: 'learn', ip: true }), 300);
}
function terminer(resultat = '') {
  if (!RUN.m || RUN.fini) return;
  RUN.fini = true; RUN.resultat = resultat; if (S.mission) { S.mission.fini = true; S.mission.tache = null; S.mission.resultat = resultat; }
  emit('missionCar', { type: 'fini', id: RUN.m.id, titre: RUN.m.titre, resultat });
}

/** les tâches d'une installation, et celles déjà réussies depuis le lancement */
export function tachesInstall() {
  const m = RUN.m; if (!m || m.kind !== 'install') return [];
  return (m.taches || []).map((id) => { const t = MISSIONS.find((x) => x.id === id); return { id, title: t ? t.title : id, text: t ? t.text : '', ok: RUN.got.has(id) }; });
}
function verifierInstall() {
  const m = RUN.m; if (!m || RUN.fini || S.mode === 'start') return;
  if (m.id === 'x-brassage' && S.mission) S.mission.pct = brassagePct();
  if (m.kind !== 'install') return;
  const vu = (/** @type {string} */ p) => RUN.vu.has(p);
  for (const id of m.taches || []) {
    if (RUN.got.has(id)) continue;
    const t = MISSIONS.find((x) => x.id === id); let ok;
    try { ok = !!(t && /** @type {any} */ (t.check)(vu)); } catch (e) { ok = false; }
    if (ok) { RUN.got.add(id); emit('missionCar', { type: 'tache', id }); }
  }
  const taches = tachesInstall(); const reste = taches.find((x) => !x.ok);
  if (S.mission) { S.mission.taches = taches; S.mission.tache = reste ? { title: reste.title, text: reste.text } : null; }
  if (!reste) terminer();
}
/** le brassage en cours (épreuve x-brassage), pour le suivi */
export const brassagePct = () => { try { return patchScore().pct; } catch (e) { return 0; } };

/** la liste pour enchaîner : choisir, puis lancer (dans le même car si possible) */
function choisirSuivante() {
  let sel = premiereAFaire(PROG);
  const go = el('button', { type: 'button', class: 'btn primary', 'data-k': 'mission:lancer' });
  const nommer = () => { const m = missionById(sel); go.textContent = m ? `Lancer « ${m.titre} »` : 'Lancer'; };
  const pick = missionPicker(sel, (id) => { sel = id; for (const b of pick.querySelectorAll('.mc-item')) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.mission === id)); nommer(); });
  nommer();
  go.onclick = () => { modal.close(); suivante(sel); };
  modal.open('Mission suivante', el('div', { class: 'mc-next' },
    el('p', { class: 'lede' }, 'Choisis la tâche suivante. Si le car convient tel qu\'il est, elle commence tout de suite ; sinon le simulateur se recharge avec le car préparé pour elle.'),
    pick, el('div', { class: 'row mc-next-acts' }, go, el('button', { type: 'button', class: 'btn', onclick: () => modal.close() }, 'Rester ici'))), { width: 760 });
}
function suivante(/** @type {string} */ id) {
  const next = missionById(id); if (!next) return;
  // un exercice d'Olivier dans un car prêt du même type : sans recharger le stade
  if (RUN.m && next.kind === 'olivier' && memeCar(RUN.m.prepa, next.prepa)) { commencer(next); renderSoon(); beginLesson(next.id); return; }
  restart('mission:' + id, next.titre);
}
const renderSoon = () => setTimeout(() => emit('missionCar', { type: 'change' }), 0);

export function installMissionRun() {
  on('missionCar', (e) => {
    if (!e) return;
    if (e.type === 'lancer' && S.mode === 'start') lancer(e.id);
    if (e.type === 'suivante') choisirSuivante();
    if (e.type === 'arreter') restart();
  });
  on('station', (id) => { if (RUN.m) RUN.vu.add(id); });
  // la fin de chaque sorte de mission
  on('tutor', (e) => { if (e && e.type === 'finish' && RUN.m && RUN.m.kind === 'olivier' && e.id === RUN.m.id) terminer(); });
  on('patchDone', () => { if (RUN.m && RUN.m.id === 'x-brassage') terminer('car brassé à 100 %'); });
  on('atelier', (e) => { if (e && e.type === 'done' && RUN.m && RUN.m.id === 'x-atelier') { const r = e.report || {}; terminer(r.errs != null ? `${r.errs} erreur${r.errs > 1 ? 's' : ''}, ${Math.floor((r.sec || 0) / 60)} min` : ''); } });
  on('scenarioDone', (r) => { if (RUN.m && RUN.m.id === 'x-match') terminer(r && r.score != null ? `score ${r.score} %` : ''); });
  on('netcourse', (e) => { if (e && e.type === 'examEnd' && RUN.m && RUN.m.id === 'x-reseau') terminer('examen rendu'); });
  on('missionCar', (e) => { if (e && e.type === 'fini') toast(`Mission réussie : ${e.titre}${e.resultat ? ` (${e.resultat})` : ''}. Enchaîne sur une autre ou arrête-toi (à gauche).`, 'good', 7000); });
  setInterval(verifierInstall, 400);
}
