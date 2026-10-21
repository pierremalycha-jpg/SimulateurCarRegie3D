// @ts-check
import { el } from '../util.js';
import { S } from '../state.js';
import { icon } from './icons.js';

// ----------------------------------------------------------------------------------
// L'espace plein écran (le Cours) : ils s'ouvrent par-dessus tout le reste, écran
// titre compris, et se referment sur ce qu'on faisait (Échap ou « Fermer »). Un seul à la fois.
// En-tête : le nom de l'espace, ses onglets, le bouton Fermer ; dessous, la page qui défile. Une
// ligne d'état en bas de l'écran porte les messages de l'espace (le car se prépare encore…).
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} LayerOpts
 * @property {string} kind identifiant de l'espace (cours, entrainement)
 * @property {string} title nom affiché sur la plaque
 * @property {string} [ico] icône de la plaque (ui/icons.js)
 * @property {[string, string][]} [tabs] onglets : [clé, libellé]
 * @property {string} [tab] onglet ouvert
 * @property {(k: string, box: HTMLElement) => (void | (() => void))} show dessine un onglet ; peut rendre de quoi le nettoyer
 */
const LY = { root: /** @type {HTMLElement | null} */ (null), kind: '', tab: '', dispose: () => {}, prev: /** @type {HTMLElement | null} */ (null), msgT: 0, opts: /** @type {LayerOpts | null} */ (null) };

/** un espace plein écran est ouvert (son identifiant, ou '') */
export const layerOpen = () => LY.kind;
/** l'onglet ouvert de l'espace */
export const layerTab = () => LY.tab;

/** @param {LayerOpts} o */
export function openLayer(o) {
  closeLayer(false);
  if (document.pointerLockElement) document.exitPointerLock();
  LY.prev = /** @type {HTMLElement | null} */ (document.activeElement);
  LY.kind = o.kind; LY.opts = o;
  const tabs = o.tabs && o.tabs.length > 1 ? el('nav', { class: 'tabs ly-tabs', 'aria-label': o.title }, ...o.tabs.map(([k, l]) => el('button', { type: 'button', class: 'tab', 'data-k': k, onclick: () => showTab(k) }, l))) : null;
  const page = el('div', { class: 'ly-page' });
  const root = el('div', { id: 'layer', class: 'ly ly-' + o.kind, role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title },
    el('header', { class: 'ly-head' },
      el('h2', { class: 'tape' }, o.ico ? icon(o.ico) : null, o.title),
      tabs,
      el('button', { type: 'button', class: 'btn small ly-close', onclick: () => closeLayer() }, el('kbd', {}, 'Échap'), 'Fermer')),
    el('div', { class: 'ly-scroll' }, page),
    el('p', { class: 'ly-msg', role: 'status', hidden: true }));
  document.body.append(root); document.body.classList.add('layer-on');
  LY.root = root;
  showTab(o.tab || (o.tabs && o.tabs[0] ? o.tabs[0][0] : ''));
  const t = /** @type {HTMLElement | null} */ (root.querySelector('.tab.on') || root.querySelector('.ly-close'));
  if (t && !matchMedia('(pointer: coarse)').matches) t.focus({ preventScroll: true });
  return root;
}
/** passe à un autre onglet de l'espace ouvert */
export function showTab(k) {
  const root = LY.root, o = LY.opts; if (!root || !o) return;
  try { LY.dispose(); } catch (e) { console.error(e); }
  LY.dispose = () => {}; LY.tab = k;
  for (const b of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('.ly-tabs > .tab'))) { b.classList.toggle('on', b.dataset.k === k); b.setAttribute('aria-pressed', String(b.dataset.k === k)); }
  const page = /** @type {HTMLElement} */ (root.querySelector('.ly-page'));
  page.replaceChildren(); page.className = 'ly-page';
  const d = o.show(k, page);
  if (typeof d === 'function') LY.dispose = d;
  /** @type {HTMLElement} */ (root.querySelector('.ly-scroll')).scrollTop = 0;
}
/** referme l'espace ; le focus revient où il était */
export function closeLayer(restore = true) {
  const root = LY.root; if (!root) return;
  try { LY.dispose(); } catch (e) { console.error(e); }
  LY.dispose = () => {}; LY.root = null; LY.kind = ''; LY.tab = ''; LY.opts = null;
  root.remove(); document.body.classList.remove('layer-on');
  clearTimeout(LY.msgT);
  if (restore && LY.prev && LY.prev.isConnected && S.mode !== 'fps') LY.prev.focus({ preventScroll: true });
  LY.prev = null;
}
/** message dans la ligne d'état de l'espace (quelques secondes) */
export function layerSay(text, ms = 5000) {
  const p = /** @type {HTMLElement | null} */ (LY.root && LY.root.querySelector('.ly-msg')); if (!p) return;
  p.textContent = text; p.hidden = false;
  clearTimeout(LY.msgT); LY.msgT = window.setTimeout(() => { p.hidden = true; }, ms);
}
