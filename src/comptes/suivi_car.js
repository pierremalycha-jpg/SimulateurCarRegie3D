// @ts-check
import { S, on } from '../state.js';
import { PROG, saveProgressSoon } from '../shared.js';
import { car as carDe, compterSeconde, CLES_MAX, SESSIONS_MAX } from './car.js';

// ----------------------------------------------------------------------------------
// Les écouteurs du suivi du car régie (v19.25) : chaque seconde de jeu, chaque geste à un poste, les
// exercices pratiques, les missions, ce qui est consulté, les pannes ; rangés dans PROG.car (forme et
// calcul : comptes/car.js), enregistrés avec la progression.
// ----------------------------------------------------------------------------------
const car = () => carDe(PROG);
const plus = (o, k, n = 1) => { o[k] = (Number(o[k]) || 0) + n; };
function compter(o, k, n = 1) { if (!k) return; const key = String(k).slice(0, 60); if (!(key in o) && Object.keys(o).length >= CLES_MAX) return; plus(o, key, n); }

/** ce qui n'est pas une manipulation du poste : son en-tête, les fenêtres, Olivier, le téléphone, l'espace plein écran */
const HORS_POSTE = '.st-head, #modal, #ask, #chef, #layer, #telephone, #toast, #hud, #title';
const T = { actif: 0, manip: 0, timer: 0, exo: /** @type {{ id: string, t0: number } | null} */ (null), n: 0 };
export function initSuiviCar() {
  if (T.timer) return;
  const geste = (/** @type {Event} */ e) => {
    T.actif = Date.now();
    // une action au poste : assis au poste, un geste sur ses commandes (interface 2D ou pupitre 3D), une touche ;
    // pas sur l'en-tête du poste (Quitter, Fiche, Téléphone), ni dans une fenêtre, Olivier ou le téléphone
    const cible = /** @type {Element | null} */ (e.target && /** @type {any} */ (e.target).closest ? e.target : null);
    const horsPoste = !!(cible && cible.closest(HORS_POSTE));
    if (S.mode === 'station' && !horsPoste && (e.type !== 'keydown' || !['Escape', 'Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(/** @type {KeyboardEvent} */ (e).key))) {
      if (e.type === 'wheel' && Date.now() - T.manip < 250) return; // une molette qui tourne compte pour un geste
      T.manip = Date.now();
      const id = S.station; if (id) { const c = car(); const p = c.postes[id] = c.postes[id] || { n: 0, s: 0, m: 0, a: 0 }; p.a++; }
    }
  };
  for (const t of ['pointerdown', 'keydown', 'wheel', 'input', 'change']) addEventListener(t, geste, { passive: true, capture: true });
  addEventListener('pointermove', () => { if (Date.now() - T.actif > 10000) T.actif = Date.now(); }, { passive: true });
  T.timer = window.setInterval(() => {
    const ok = compterSeconde(car(), { mode: S.mode, station: S.station, inTruck: S.inTruck }, Date.now(), T.actif, T.manip, document.visibilityState === 'visible');
    // enregistré toutes les deux minutes de jeu (l'envoi en ligne est de toute façon limité : shared.js)
    if (ok && ++T.n % 120 === 0) saveProgressSoon();
  }, 1000);

  // une partie commence (Jouer → car régie) : une session de plus
  on('started', (/** @type {any} */ e) => {
    const c = car(); for (const s of c.sessions) s.fin = true;
    c.sessions.push({ at: Date.now(), s: 0, p: String((e && e.preset) || '').slice(0, 30), mode: String(/** @type {any} */ (S).modeCar || '').slice(0, 20), postes: [] });
    c.sessions = c.sessions.slice(-SESSIONS_MAX); saveProgressSoon();
  });
  // s'asseoir à un poste, le quitter
  on('station', (/** @type {string} */ id) => {
    const c = car(); const p = c.postes[id] = c.postes[id] || { n: 0, s: 0, m: 0, a: 0 }; p.n++; p.d = Date.now();
    const se = c.sessions[c.sessions.length - 1]; if (se && !se.fin && !se.postes.includes(id)) se.postes.push(id);
  });
  on('stationClose', () => saveProgressSoon());
  // les exercices pratiques d'Olivier (tutor/engine.js)
  on('tutor', (/** @type {any} */ e) => {
    if (!e) return;
    const c = car();
    const ex = (id) => (c.exos[id] = c.exos[id] || { n: 0, f: 0, ab: 0, aide: 0, ind: 0, err: 0, s: 0 });
    if (e.type === 'start' && e.id) { ex(e.id).n++; ex(e.id).d = Date.now(); T.exo = { id: e.id, t0: Date.now() }; }
    else if (T.exo && e.type === 'hint') ex(T.exo.id).ind++;
    else if (T.exo && e.type === 'auto') ex(T.exo.id).aide++;
    else if (T.exo && e.type === 'answer' && e.ok === false) ex(T.exo.id).err++;
    else if ((e.type === 'finish' || e.type === 'stop') && e.id) {
      const x = ex(e.id);
      if (e.type === 'finish') x.f++; else x.ab++;
      if (T.exo && T.exo.id === e.id) x.s += Math.round((Date.now() - T.exo.t0) / 1000);
      x.d = Date.now(); T.exo = null; saveProgressSoon();
    }
  });
  // les missions spécifiques (game/mission_run.js)
  on('missionCar', (/** @type {any} */ e) => {
    if (!e || !e.id || (e.type !== 'lancer' && e.type !== 'fini')) return;
    const c = car(); const m = c.missions[e.id] = c.missions[e.id] || { n: 0, f: 0 };
    if (e.type === 'lancer') m.n++; else { m.f++; if (e.titre) m.titre = String(e.titre).slice(0, 80); m.r = String(e.resultat || '').slice(0, 120); }
    m.d = Date.now(); saveProgressSoon();
  });
  // ce qu'il a consulté
  on('device', (/** @type {any} */ e) => { if (e && e.key) compter(car().vus.app, e.key); });
  on('teleport', (/** @type {number} */ i) => compter(car().vus.lieux, String(i)));
  on('modalopen', (/** @type {any} */ titre) => { if (typeof titre === 'string' && S.mode !== 'start') compter(car().vus.fen, titre.replace(/\s+/g, ' ').trim()); });
  on('plan', () => compter(car().vus.fen, 'Plan des caméras'));
  // les pannes (simulateur de pannes, jour de match, épreuves)
  on('faultNew', () => { plus(car().pannes, 'n'); });
  on('faultSolved', () => { plus(car().pannes, 'ok'); saveProgressSoon(); });
}

