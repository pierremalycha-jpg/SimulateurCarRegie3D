// @ts-check
import { el } from '../../util.js';
import PAGE_BRUTE from '../dot2/simulateur_dot2.html';
import { STUDIO_PLATEAU1 } from '../dot2/show_depart.js';

// ----------------------------------------------------------------------------------
// L'atelier « Console lumière dot2 » : le simulateur de console écrit à part (une page complète,
// src/labo/dot2/simulateur_dot2.html, gardée telle quelle dans le dépôt), ouvert dans un cadre la
// première fois qu'on choisit l'onglet. Il garde ses réglages et ses exercices guidés dans le stockage
// du navigateur (clés « simdot2.* »).
// Pour ses défis de programmation (labo/defis/dot2.js), le Labo pose au chargement un crochet d'une
// ligne dans la page (CROCHET : la fin du constructeur de l'application publie l'application sous
// window.__laboDot2, rien d'autre ne change) : il y lit le show en mémoire (pas besoin de sauvegarder)
// et y charge le show de départ d'un défi, ou celui de la solution. Sans crochet (page changée), il
// passe par la sauvegarde de la console : « simdot2.session », lue au démarrage du cadre.
// ----------------------------------------------------------------------------------
const CROCHET = ['this.restoreSession()}start(){', 'this.restoreSession(),window.__laboDot2=this}start(){'];
export const PAGE = PAGE_BRUTE.includes(CROCHET[0]) ? PAGE_BRUTE.replace(CROCHET[0], CROCHET[1]) : PAGE_BRUTE;
const clone = (x) => JSON.parse(JSON.stringify(x));

export function creer() {
  /** @type {HTMLIFrameElement | null} */ let cadre = null;
  const attente = el('p', { class: 'lb-note lb-dot2-wait' }, 'Ouverture de la console…');
  const root = el('div', { class: 'lb-atelier lb-dot2' }, attente);
  const app = () => { try { return /** @type {any} */ (cadre && cadre.contentWindow ? cadre.contentWindow : null)?.__laboDot2 || null; } catch (e) { return null; } };
  function ouvrir() {
    if (cadre) cadre.remove();
    attente.hidden = false;
    cadre = /** @type {HTMLIFrameElement} */ (el('iframe', { class: 'lb-dot2-frame', title: 'Simulateur de console lumière dot2', allow: 'fullscreen' }));
    cadre.addEventListener('load', () => { attente.hidden = true; });
    cadre.srcdoc = PAGE;
    root.append(cadre);
  }
  function rendre() { if (!cadre) ouvrir(); }
  /** charge un show dans la console (le plateau 1 avec), et le garde comme sa sauvegarde */
  function charger(/** @type {any} */ show) {
    try {
      localStorage.setItem('simdot2.session', JSON.stringify({ show, showName: show.name }));
      localStorage.setItem('simdot2.studio', JSON.stringify(STUDIO_PLATEAU1));
      localStorage.removeItem('simdot2.exerciseRun');
    } catch (e) { /* stockage indisponible : le crochet suffit */ }
    const A = app();
    if (A && A.console) {
      try { if (A.setStudio) A.setStudio(clone(STUDIO_PLATEAU1)); A.console.setShow(clone(show)); if (A.persistSession) A.persistSession(); if (A.emit) A.emit(); return; } catch (e) { /* on recharge le cadre */ }
    }
    ouvrir();
  }
  /** le show de la console : en mémoire (crochet), sinon sa dernière sauvegarde */
  function lire() {
    const A = app();
    if (A && A.console && A.console.show) return { show: clone(A.console.show) };
    try { const s = JSON.parse(localStorage.getItem('simdot2.session') || 'null'); return { show: s && s.show ? s.show : null }; } catch (e) { return { show: null }; }
  }
  /** le show en cours a-t-il déjà des cues (un défi va le remplacer) */
  const programme = () => { const st = lire(); const S = st.show; return !!S && ((S.main && S.main.cues && S.main.cues.length > 0) || Object.keys(S.executors || {}).length > 0); };
  return {
    root, rendre, cadre: () => cadre, lire, programme,
    preparer: (/** @type {any} */ scene) => { if (scene && scene.show) charger(scene.show); },
    appliquer: (/** @type {any} */ corrige) => { if (corrige && corrige.show) charger(corrige.show); },
  };
}
