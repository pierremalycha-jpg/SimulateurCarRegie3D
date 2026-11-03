// @ts-check
import { PROG, saveProgressSoon } from '../shared.js';

// ----------------------------------------------------------------------------------
// Le temps de travail (v19.24) : une minute est comptée quand la page est visible et que la personne
// a agi (clavier, souris, toucher) dans les deux dernières minutes ; une page laissée ouverte ne compte
// pas. Rangé par jour dans la progression (PROG.jours : { 'AAAA-MM-JJ': minutes }), lu par le
// tableau de bord du professeur (cette semaine, depuis le début). Enregistré toutes les cinq minutes.
// ----------------------------------------------------------------------------------
export const PAUSE_MS = 120000;
let derniere = 0, minutes = 0, timer = 0;
/** l'heure locale du jour, au format de PROG.jours */
export const cleJour = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** compte une minute si la personne est là (pur, pour les tests : rend true si la minute est comptée) */
export function compterMinute(prog, now, vu, actif) {
  if (!vu || now - actif > PAUSE_MS) return false;
  const J = prog.jours = prog.jours || {}; const k = cleJour(now);
  J[k] = (J[k] || 0) + 1;
  return true;
}
export function initActivite() {
  if (timer) return;
  const bouge = () => { derniere = Date.now(); };
  for (const t of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(t, bouge, { passive: true, capture: true });
  addEventListener('pointermove', () => { if (Date.now() - derniere > 15000) derniere = Date.now(); }, { passive: true });
  timer = window.setInterval(() => {
    if (compterMinute(PROG, Date.now(), document.visibilityState === 'visible', derniere) && ++minutes % 5 === 0) saveProgressSoon();
  }, 60000);
}
