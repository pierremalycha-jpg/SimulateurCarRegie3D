// @ts-check
import { el } from '../../util.js';
import PAGE from '../dot2/simulateur_dot2.html';

// ----------------------------------------------------------------------------------
// L'atelier « Console lumière dot2 » : le simulateur de console écrit à part (une page complète,
// src/labo/dot2/simulateur_dot2.html, gardée telle quelle), ouvert dans un cadre la première fois
// qu'on choisit l'onglet. Il garde ses réglages et ses exercices dans le stockage du navigateur
// (clés « simdot2.* ») ; il n'a pas de défi noté dans le Labo.
// ----------------------------------------------------------------------------------
export function creer() {
  /** @type {HTMLIFrameElement | null} */ let cadre = null;
  const attente = el('p', { class: 'lb-note lb-dot2-wait' }, 'Ouverture de la console…');
  const root = el('div', { class: 'lb-atelier lb-dot2' }, attente);
  function rendre() {
    if (cadre) return;
    cadre = /** @type {HTMLIFrameElement} */ (el('iframe', { class: 'lb-dot2-frame', title: 'Simulateur de console lumière dot2', allow: 'fullscreen' }));
    cadre.addEventListener('load', () => { attente.hidden = true; });
    cadre.srcdoc = PAGE;
    root.append(cadre);
  }
  return { root, rendre, cadre: () => cadre };
}
