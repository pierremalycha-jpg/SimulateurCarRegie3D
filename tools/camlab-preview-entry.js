/* global document, window */
// Page d'essai du module « La caméra », seule (tools/camlab-preview.mjs) : un petit écran
// d'accueil avec le bouton du module ; le module s'ouvre tout de suite, « Quitter » ramène ici.
import { initCamLab, openCameraLab, camlabDebug } from '../src/camlab/index.js';
import { el } from '../src/util.js';

const home = el('div', { id: 'title', class: 'cl-home' },
  el('div', { class: 'cl-home-in' },
    el('h1', {}, 'La caméra'),
    el('p', {}, 'Maquette du module du TIEE Simulator : une caméra de plateau type Sony HXC-FB80 avec son zoom Fujinon, pièce par pièce.'),
    el('button', { type: 'button', class: 'ti-key primary', id: 'ti-camera' }, el('span', { class: 'ti-led', 'aria-hidden': 'true' }), el('b', {}, 'La caméra'), el('small', {}, 'Connaître la caméra de plateau, de la lentille au moniteur'))));
document.body.append(home);
const css = document.createElement('style');
css.textContent = '.cl-home{position:fixed;inset:0;display:grid;place-items:center;background:radial-gradient(ellipse at 72% 28%,#26303a 0%,#161b20 58%,#0e1215 100%)}.cl-home-in{display:grid;gap:14px;max-width:520px;padding:0 16px}.cl-home h1{margin:0;font:700 56px/.95 var(--f-disp)}.cl-home p{margin:0;color:var(--muted);line-height:1.5}';
document.head.append(css);
initCamLab();
/** @type {HTMLElement} */ (document.getElementById('ti-camera')).onclick = () => openCameraLab();
openCameraLab();
window.__camlab = camlabDebug; // essais automatiques (captures)
