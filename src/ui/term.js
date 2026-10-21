// @ts-check
import { el } from '../util.js';
import { emit } from '../state.js';
import { CATS, TERMS, termFor } from '../content/netterms.js';
import { FIGS } from './term_figs.js';
// fiches et schémas ajoutés par d'autres postes (mesure vidéo, réseau de contrôle du car SDI)
import '../content/terms_mesure.js';
import '../content/terms_ctrlnet.js';
import './figs_mesure.js';
import './figs_ctrlnet.js';
import '../content/terms_videohub.js';
import './figs_videohub.js';
import { rich } from './rich.js';

// ----------------------------------------------------------------------------------
// Bouton « ? » à côté des termes techniques des postes, et sa fenêtre explicative : l'essentiel
// en une phrase, un schéma, l'explication, ce qu'on en voit dans le car, des renvois et la norme
// de référence. Le lexique regroupe toutes les fiches. Ce sont les fiches du Cours (rangées par
// thème dans l'onglet Notions) : « Ouvrir dans le Cours » y mène.
// La fenêtre n'est pas modale : la station reste visible et continue de vivre derrière.
// ----------------------------------------------------------------------------------
const TP = { box: /** @type {HTMLElement|null} */ (null), anchor: /** @type {HTMLElement|null} */ (null), stack: /** @type {string[]} */ ([]), cur: '', filter: '' };
const LEX = '*lexique';

/** bouton « ? » pour une fiche */
export function q(id) {
  const T = TERMS[id]; if (!T) return null;
  ensureBox();
  return el('button', { type: 'button', class: 'q', 'data-term': id, 'aria-label': 'Explication : ' + T.t, 'aria-haspopup': 'dialog', title: T.t + ' : explication' }, '?');
}

// intitulés examinés : en-têtes de tableau, clés des listes, étiquettes de champ, titres de carte
const SEL = 'th, dt, label, h3, h4, summary, .net-st > b, .ops-legname, .q-auto, [data-qterm]';
/** ajoute un « ? » aux intitulés reconnus (une seule fois par intitulé) */
export function qify(root, sel = SEL) {
  if (!root) return;
  ensureBox();
  for (const n of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(sel))) {
    if (n.querySelector(':scope > .q') || n.closest('#termpop') || n.closest('.q-none')) continue;
    const id = n.dataset.qterm || termFor(n.textContent);
    if (!id || !TERMS[id]) continue;
    // dans une étiquette qui contient le champ, le bouton suit le texte (pas après la case à cocher)
    const txt = n.tagName === 'LABEL' && n.querySelector(':scope > span');
    (txt || n).append(q(id));
  }
}

// liste « clé : valeur » mise à jour à chaque image : on ne la reconstruit que si les intitulés
// changent, sinon on remplace seulement les valeurs (les boutons « ? » restent cliquables)
export function liveKv(dl) {
  let keys = null;
  return (/** @type {any[]} */ rows) => {
    rows = rows.filter(Boolean);
    const k = rows.map((r) => r[0]).join('§');
    if (k !== keys) { keys = k; dl.replaceChildren(...rows.flatMap(([a]) => [el('dt', {}, a), el('dd')])); qify(dl); }
    const dds = dl.querySelectorAll(':scope > dd');
    rows.forEach(([, v, cls], i) => { const d = dds[i]; const s = String(v); if (d.textContent !== s) d.textContent = s; const c = cls || ''; if (d.className !== c) d.className = c; });
  };
}

// ---------------- fenêtre ----------------
export const termOpen = () => !!(TP.box && !TP.box.hidden);
export function closeTerm() {
  if (!termOpen()) return;
  TP.box.hidden = true; TP.stack = []; TP.cur = '';
  const a = TP.anchor; TP.anchor = null;
  if (a && a.isConnected) a.focus({ preventScroll: true });
}
function ensureBox() {
  if (TP.box) return TP.box;
  const box = el('div', { id: 'termpop', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'termpop-t', hidden: true, tabindex: '-1' });
  document.body.append(box);
  // un clic hors de la fenêtre la ferme (sauf sur un autre « ? », qui la remplit)
  document.addEventListener('pointerdown', (e) => { const t = /** @type {HTMLElement} */ (e.target); if (termOpen() && !box.contains(t) && !(t.closest && t.closest('.q'))) closeTerm(); }, true);
  // délégation : tous les boutons « ? » de la page
  document.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const b = /** @type {HTMLElement|null} */ (t.closest ? t.closest('.q[data-term]') : null);
    if (!b || box.contains(b)) return;
    e.preventDefault(); e.stopPropagation();
    if (termOpen() && TP.cur === b.dataset.term && TP.anchor === b) { closeTerm(); return; }
    openTerm(b.dataset.term, /** @type {HTMLElement} */ (b));
  }, true);
  addEventListener('resize', () => { if (termOpen()) place(); });
  TP.box = box;
  return box;
}

/** ouvre la fiche `id` près de l'élément `anchor` (sinon au centre) */
export function openTerm(id, anchor = null, how = 'new') {
  const T = TERMS[id]; if (!T && id !== LEX) return;
  const box = ensureBox();
  if (anchor) TP.anchor = anchor;
  if (how === 'new') TP.stack = [];
  else if (how === 'push' && TP.cur && TP.cur !== id) TP.stack.push(TP.cur);
  TP.cur = id;
  box.replaceChildren(...(id === LEX ? lexView() : termView(id, T)));
  box.classList.toggle('lex', id === LEX);
  box.hidden = false;
  place();
  const s = box.querySelector('.tp-scroll'); if (s) s.scrollTop = 0;
  // au doigt, pas de focus sur la recherche : le clavier virtuel masquerait la liste
  const touch = matchMedia('(pointer: coarse)').matches;
  /** @type {HTMLElement} */ (box.querySelector(id === LEX && !touch ? '.tp-search' : '.tp-x')).focus({ preventScroll: true });
  if (id !== LEX) emit('netlog', { type: 'term', id });
}
export const openLexique = (anchor = null) => openTerm(LEX, anchor);

function head(title, cat) {
  const back = TP.stack.length ? el('button', { type: 'button', class: 'tp-back', 'aria-label': 'Retour', title: 'Retour', onclick: () => openTerm(TP.stack.pop(), null, 'back') }, '←') : null;
  return el('header', { class: 'tp-head' }, back, el('div', { class: 'grow' }, cat ? el('span', { class: 'tp-cat' }, cat) : null, el('h3', { id: 'termpop-t' }, title)),
    el('button', { type: 'button', class: 'tp-x', 'aria-label': 'Fermer', title: 'Fermer (Échap)', onclick: closeTerm }, '×'));
}
function termView(id, T) {
  const fig = T.fig && FIGS[T.fig] ? el('figure', { class: 'tp-fig', html: FIGS[T.fig]() }) : null;
  const see = (T.see || []).filter((k) => TERMS[k]);
  return [head(T.t, T.cat),
    el('div', { class: 'tp-scroll' },
      T.aka ? el('div', { class: 'tp-aka' }, T.aka) : null,
      el('p', { class: 'tp-short' }, T.short),
      fig,
      rich(T.body, 'tp-body'),
      T.car ? el('div', { class: 'tp-car' }, el('b', {}, 'Dans le car'), el('span', {}, T.car)) : null,
      see.length ? el('div', { class: 'tp-see' }, el('b', {}, 'Voir aussi'), ...see.map((k) => el('button', { type: 'button', class: 'tp-chip', 'data-see': k, onclick: () => openTerm(k, null, 'push') }, TERMS[k].t))) : null,
      T.ref ? el('div', { class: 'tp-ref' }, 'Référence : ' + T.ref) : null),
    el('footer', { class: 'tp-foot' },
      el('button', { type: 'button', class: 'btn small primary', 'data-cours': id, title: 'La fiche en plein écran, avec les autres notions du même thème', onclick: () => { closeTerm(); emit('cours', { fiche: id }); } }, 'Ouvrir dans le Cours'),
      el('button', { type: 'button', class: 'btn small', onclick: () => openTerm(LEX, null, 'push') }, `Lexique (${Object.keys(TERMS).length} termes)`))];
}
function lexView() {
  const list = el('div', { class: 'tp-lex' });
  const search = el('input', { type: 'search', class: 'tp-search', placeholder: 'Rechercher un terme (gigue, IGMP, BMCA…)', 'aria-label': 'Rechercher un terme', value: TP.filter, spellcheck: 'false' });
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const fill = () => {
    const f = norm(TP.filter.trim());
    list.replaceChildren();
    for (const c of CATS) {
      const ids = Object.keys(TERMS).filter((k) => TERMS[k].cat === c && (!f || norm(TERMS[k].t + ' ' + (TERMS[k].aka || '') + ' ' + TERMS[k].short).includes(f)));
      if (!ids.length) continue;
      list.append(el('h4', {}, c), el('div', { class: 'tp-lexgrid' }, ...ids.map((k) => el('button', { type: 'button', class: 'tp-lexi', 'data-see': k, title: TERMS[k].short, onclick: () => openTerm(k, null, 'push') }, el('b', {}, TERMS[k].t), el('span', {}, TERMS[k].short)))));
    }
    if (!list.children.length) list.append(el('p', { class: 'note' }, 'Aucun terme ne correspond.'));
  };
  search.addEventListener('input', () => { TP.filter = /** @type {HTMLInputElement} */ (search).value; fill(); });
  fill();
  return [head('Lexique des postes', ''), el('div', { class: 'tp-scroll' }, el('p', { class: 'note' }, 'Toutes les fiches des boutons « ? » des postes, par famille. Le Cours les range aussi par thème (touche G).'), search, list)];
}

// à côté du bouton sur grand écran ; en bas de l'écran (feuille) sur téléphone
function place() {
  const box = TP.box; const vw = innerWidth, vh = innerHeight;
  box.style.left = box.style.top = '';
  if (vw < 760) { box.classList.add('tp-sheet'); return; }
  box.classList.remove('tp-sheet');
  const w = box.offsetWidth, h = box.offsetHeight;
  const a = TP.anchor && TP.anchor.isConnected ? TP.anchor.getBoundingClientRect() : null;
  let x = (vw - w) / 2, y = (vh - h) / 2;
  if (a) {
    x = a.right + 12 + w <= vw - 16 ? a.right + 12 : a.left - 12 - w >= 16 ? a.left - 12 - w : Math.min(Math.max(16, a.left - w / 2), vw - w - 16);
    y = Math.min(Math.max(16, a.top - 40), vh - h - 16);
  }
  box.style.left = Math.round(Math.max(16, x)) + 'px'; box.style.top = Math.round(Math.max(16, y)) + 'px';
}
