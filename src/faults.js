import { S, emit, on, camById } from './state.js';
import { el, randPick, fmt } from './util.js';
import { ROUTER, EVS, evsSetRecording, route } from './pipeline.js';
import { toast, intercom } from './ui/common.js';
import { IP_FAULTS, NET } from './ipnet.js';

// Simulateur de pannes (formation chef de car / maintenance)
export const FAULTS = [
  {
    id: 'fibre', label: 'Coupure de fibre caméra', where: 'Baie CCU',
    can: () => S.cams.some((c) => c.link !== 'hf'),
    inject() { const c = randPick(S.cams.filter((x) => x.link !== 'hf')); c.fiberCut = true; c.checkLink(); return { cam: c.id }; },
    check: (st) => { const c = camById(st.cam); return !c || !c.fiberCut; },
    hint: 'Multiview : PAS DE SIGNAL sur une caméra. Baie CCU : niveau optique nul → basculer sur la fibre de secours.',
  },
  {
    id: 'genlock', label: 'Perte de référence (genlock) sur une CCU', where: 'Baie CCU / Synchro',
    can: () => S.cams.length > 0,
    inject() { const c = randPick(S.cams); c.genlock = false; return { cam: c.id }; },
    check: (st) => { const c = camById(st.cam); return !c || c.genlock; },
    hint: 'Une image saute au multiview (alarme RÉF.). Baie CCU ou synchro : re-verrouiller la référence.',
  },
  {
    id: 'jam', label: 'Brouillage sur une fréquence HF', where: 'Régie HF',
    can: () => S.cams.some((c) => c.rf),
    inject() { const c = randPick(S.cams.filter((x) => x.rf)); S.faults.jam = { f: c.rf.ch }; return { cam: c.id, f: c.rf.ch }; },
    check: (st) => { const c = camById(st.cam); return !c || !c.rf || Math.abs(c.rf.ch - st.f) >= c.rf.bw; },
    hint: 'Macro-blocs puis perte de la caméra HF. Analyseur de spectre : une porteuse inconnue sur le canal → changer de fréquence (canal attribué libre).',
  },
  {
    id: 'evsrec', label: 'Enregistrement EVS arrêté', where: 'EVS',
    can: () => true,
    inject() { evsSetRecording(false); return {}; },
    check: () => EVS.recording,
    hint: 'Les ralentis récents sont impossibles. Poste EVS : relancer REC.',
  },
  {
    id: 'drift', label: 'Dérive colorimétrique d\'une caméra', where: 'Vision',
    can: () => S.cams.length > 0,
    inject() { const c = randPick(S.cams); c.hidden.tR *= 1.14; c.hidden.tB *= 0.9; return { cam: c.id }; },
    check: (st) => { const c = camById(st.cam); if (!c) return true; const e = c.colorError(); return Math.abs(e.r) < 0.03 && Math.abs(e.b) < 0.03; },
    hint: 'Une caméra tire vers le rouge/jaune. Vision : vecteurscope, puis AUTO WHITE ou gains R/B.',
  },
  {
    id: 'tx', label: 'Coupure de la liaison TX1 (fibre opérateur)', where: 'Transmission',
    can: () => true,
    inject() { S.faults.tx = true; S.txPath = 1; return {}; },
    check: () => S.txPath === 2,
    hint: 'Retour antenne perdu. Transmission : basculer sur le chemin de secours TX2 et prévenir la chaîne.',
  },
  {
    id: 'router', label: 'Erreur de manipulation sur la grille', where: 'Grille',
    can: () => true,
    inject() { route('AUX_TX1', 'BARS'); route('AUX_TX2', 'BARS'); return {}; },
    check: () => ROUTER.map[S.txPath === 2 ? 'AUX_TX2' : 'AUX_TX1'] === 'PGM',
    hint: 'La chaîne reçoit la mire au lieu du programme (visible au retour antenne). Grille : remettre le PGM sur le départ TX.',
  },
  {
    id: 'expo', label: 'Iris refermé sur une caméra', where: 'Vision',
    can: () => S.cams.length > 0,
    inject() { const c = randPick(S.cams); c.paint.iris = Math.min(22, c.paint.iris * 2.8); c.paint.autoIris = false; return { cam: c.id }; },
    check: (st) => { const c = camById(st.cam); return !c || (c.meter.mean > 0.3 && c.meter.mean < 0.62); },
    hint: 'Une image est très sombre. Vision : rouvrir l\'iris en surveillant le waveform.',
  },
];

FAULTS.push(...IP_FAULTS);
export const ACTIVE = [];
S.faultsSolved = 0;
export function injectFault(id, hidden = false) {
  const pool = FAULTS.filter((f) => f.can());
  const f = id === 'random' ? randPick(pool) : FAULTS.find((x) => x.id === id);
  if (!f || !f.can()) { toast('Cette panne n\'est pas possible avec la configuration actuelle.', 'bad'); return; }
  const st = f.inject();
  const entry = { f, st, t0: S.time, hidden, done: false };
  ACTIVE.push(entry);
  toast(hidden ? 'Une panne a été injectée. À vous de la trouver !' : `Panne injectée : ${f.label}`, 'bad');
  if (hidden) intercom('CHAÎNE', 'Problème signalé côté antenne ou régie, pouvez-vous vérifier ?', 'bad');
  emit('fault');
  return entry;
}
export function activeFaults() { return ACTIVE.filter((a) => !a.done); }
export function updateFaults() {
  for (const a of ACTIVE) {
    if (a.done) continue;
    if (a.f.check(a.st)) {
      a.done = true; a.dt = S.time - a.t0; S.faultsSolved++;
      if (a.f.id === 'jam') { /* le brouilleur reste sur sa fréquence */ }
      toast(`Panne résolue en ${Math.round(a.dt)} s : ${a.f.label}`, 'good', 5000);
      emit('fault');
    }
  }
}
export function clearFaults() {
  for (const a of ACTIVE) if (!a.done) {
    const c = a.st.cam ? camById(a.st.cam) : null;
    if (a.f.id === 'fibre' && c) { c.fiberCut = false; c.checkLink(); }
    if (a.f.id === 'genlock' && c) c.genlock = true;
    if (a.f.id === 'evsrec') evsSetRecording(true);
    if (a.f.id === 'drift' && c) c.autoWhite();
    if (a.f.id === 'tx') { S.txPath = 1; }
    if (a.f.id === 'router') { route('AUX_TX1', 'PGM'); route('AUX_TX2', 'PGM'); }
    a.done = true;
  }
  S.faults.jam = null; S.faults.tx = false;
  Object.assign(NET, { red: true, blue: true, gm1: true, gm2: true, nmos: true, mvLink: 100, mvSat: false, gmActive: 1, lostPtpT: 0 });
  emit('fault');
}

export function faultPanel() {
  const root = el('div', { class: 'list' });
  const row = el('div', { class: 'hwrow' },
    el('button', { class: 'btn primary', onclick: () => injectFault('random', true) }, 'Mode examen : panne aléatoire cachée'),
    el('button', { class: 'btn danger', onclick: () => { clearFaults(); toast('Toutes les pannes ont été réparées'); } }, 'Tout réparer'));
  const list = el('div', { class: 'list' });
  for (const f of FAULTS) list.appendChild(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, f.label), el('div', { class: 's' }, `Poste concerné : ${f.where} · ${f.hint}`)), el('button', { class: 'btn small', onclick: () => injectFault(f.id) }, 'Injecter')));
  const act = el('div', { class: 'list' });
  root.append(row, el('h3', { class: 'note' }, 'Pannes en cours'), act, el('h3', { class: 'note' }, 'Catalogue'), list);
  return {
    el: root,
    update() {
      act.innerHTML = '';
      const a = ACTIVE.slice(-8).reverse();
      if (!a.length) act.appendChild(el('div', { class: 'note' }, 'Aucune panne injectée.'));
      for (const x of a) act.appendChild(el('div', { class: 'item' }, el('span', { class: 'dot ' + (x.done ? 'green' : 'red') }), el('div', { class: 'grow' }, el('div', { class: 't' }, x.hidden && !x.done ? 'Panne cachée (examen)' : x.f.label), el('div', { class: 's' }, x.done ? `Résolue en ${Math.round(x.dt)} s` : `Depuis ${Math.round(S.time - x.t0)} s${x.hidden ? ' · indice : ' + x.f.where : ''}`))));
    },
  };
}
