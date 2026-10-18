// @ts-check
import * as THREE from 'three';
import { S } from '../state.js';
import { el, clamp } from '../util.js';
import { setCloudQuality, W } from '../world.js';
import { $ } from '../ui/common.js';
import { PL } from './player.js';

// ----------------------------------------------------------------------------------
// Vue du joueur : moteur de rendu WebGL, caméra « des yeux », qualité graphique.
// ----------------------------------------------------------------------------------
/** @type {THREE.WebGLRenderer} */
export let renderer;
export const pcam = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 3000);
pcam.rotation.order = 'YXZ';
pcam.layers.enable(1); pcam.layers.enable(2);

function fatal(msg) {
  const e = $('#err'); e.hidden = false; e.innerHTML = '';
  e.append(el('div', { class: 'sheet', style: { width: 'min(620px,100%)' } }, el('header', {}, el('h2', {}, 'Le simulateur ne peut pas démarrer')), el('div', { class: 'body prose' }, el('p', {}, msg), el('p', { class: 'note' }, 'Il faut un navigateur récent avec WebGL 2 (Chrome, Edge, Firefox, Safari 15+) et l\'accélération matérielle activée.'))));
}

export function createRenderer() {
  const canvas = $('#gl');
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { fatal('WebGL n\'est pas disponible sur cet appareil.'); throw e; }
  if (!renderer.capabilities.isWebGL2) { fatal('Ce navigateur ne prend pas en charge WebGL 2.'); throw new Error('webgl2'); }
  renderer.setPixelRatio(S.lite ? 0.5 : Math.min(window.devicePixelRatio || 1, S.quality === 'basse' ? 1 : 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.autoClear = true;
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    pcam.aspect = window.innerWidth / window.innerHeight; pcam.updateProjectionMatrix();
  });
  return renderer;
}

export function setQuality(v) {
  S.quality = v; setCloudQuality(v);
  try { localStorage.setItem('carregie.quality', v); } catch (e) { /* stockage indisponible */ }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, v === 'basse' ? 1 : 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  for (const c of S.cams) c.resizeRT();
  const sm = v === 'haute' ? 4096 : 2048;
  if (W.sun.shadow.mapSize.x !== sm) { W.sun.shadow.mapSize.set(sm, sm); if (W.sun.shadow.map) { W.sun.shadow.map.dispose(); W.sun.shadow.map = null; } }
}

// plan proche adaptatif : la précision du tampon de profondeur dépend du rapport far / near. Avec un plan
// proche à 5 cm, deux surfaces distantes de quelques centimètres « clignotent » dès 100 m (z-fighting) ;
// on le recule quand on vole haut (rien n'est alors à portée de main) et on le rapproche dans le car.
export function updateNear() {
  let n = 0.1;
  if (S.mode === 'start') n = 2;
  else if (S.inTruck) n = 0.04;
  else if (PL.fly) n = clamp(0.1 + Math.max(0, PL.pos.y - 6) * 0.03, 0.1, 4);
  if (Math.abs(pcam.near - n) > 0.004) { pcam.near = n; pcam.updateProjectionMatrix(); }
}
