// @ts-check
import { el } from '../../util.js';
import { icon } from '../icons.js';
import { FICHES, THEMES } from '../../content/cours/index.js';
import { CATS, TERMS } from '../../content/netterms.js';
import { ficheView, ficheTitle, ficheShort, ficheKind } from './fiche.js';

// ----------------------------------------------------------------------------------
// La section Cours : à gauche les notions par thème (et la recherche), à droite la fiche ouverte.
// Une LED dit l'état de chaque fiche : verte, avec manipulation ; ambre, fiche du lexique
// réseau ; éteinte, en préparation. Les fiches du lexique sont toutes accessibles par la
// recherche et par « Tout le lexique réseau ».
// ----------------------------------------------------------------------------------
const KIND = { lab: ['green', 'avec manipulation'], term: ['amber', 'fiche du lexique'], prevu: ['', 'en préparation'] };
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * @param {{ go: (target: { label: string, station?: string, lesson?: string }) => void, start?: string }} opts
 * @returns {HTMLElement}
 */
export function coursView(opts) {
  let cur = '', dispose = () => {};
  const main = el('div', { class: 'co-main', tabindex: '-1' });
  const list = el('div', { class: 'co-list' });
  const search = /** @type {HTMLInputElement} */ (el('input', { type: 'search', id: 'co-search', class: 'co-search', placeholder: 'Rechercher une notion (SDI, multicast, PTP…)', 'aria-label': 'Rechercher une notion', spellcheck: 'false', autocomplete: 'off' }));
  const item = (id) => {
    const [led, label] = KIND[ficheKind(id)];
    return el('li', {}, el('button', { type: 'button', class: 'co-item', 'data-fiche': id, 'aria-current': id === cur ? 'true' : null, onclick: () => open(id) },
      el('i', { class: 'co-led ' + led }), el('span', {}, el('b', {}, ficheTitle(id)), el('small', {}, label))));
  };
  const drawList = () => {
    const q = norm(search.value.trim());
    if (q) {
      const ids = [...Object.keys(FICHES).filter((k) => !FICHES[k].term), ...Object.keys(TERMS)]
        .filter((k) => norm(ficheTitle(k) + ' ' + ficheShort(k) + ' ' + ((TERMS[k] && TERMS[k].aka) || '')).includes(q));
      list.replaceChildren(ids.length ? el('ul', { class: 'co-items' }, ...ids.slice(0, 40).map(item)) : el('p', { class: 'note' }, 'Aucune notion ne correspond.'));
      return;
    }
    list.replaceChildren(...THEMES.map((th) => {
      const ready = th.fiches.filter((k) => ficheKind(k) !== 'prevu').length;
      return el('section', { class: 'co-theme' },
        el('h3', {}, icon(th.icon), el('span', {}, th.nom), el('small', {}, `${ready} / ${th.fiches.length}`)),
        el('ul', { class: 'co-items' }, ...th.fiches.map(item)));
    }),
    el('button', { type: 'button', class: 'linkbtn co-lexbtn', onclick: () => open('*lexique') }, `Tout le lexique réseau (${Object.keys(TERMS).length} fiches)`));
  };
  search.addEventListener('input', drawList);
  const lexique = () => el('article', { class: 'co-fiche' },
    el('header', { class: 'co-head' }, el('span', { class: 'co-kicker' }, 'Réseau'), el('h2', { id: 'co-fiche-t' }, 'Le lexique réseau et ST 2110')),
    el('p', { class: 'co-short' }, 'Les fiches des boutons « ? » du poste Réseau IP. Elles entrent telles quelles dans le Cours ; les plus utiles recevront une manipulation.'),
    ...CATS.map((c) => el('section', { class: 'co-lexcat' }, el('h3', {}, c),
      el('div', { class: 'tp-lexgrid' }, ...Object.keys(TERMS).filter((k) => TERMS[k].cat === c).map((k) => el('button', { type: 'button', class: 'tp-lexi', onclick: () => open(k) }, el('b', {}, TERMS[k].t), el('span', {}, TERMS[k].short)))))));
  function open(id) {
    dispose(); dispose = () => {};
    if (narrow.matches) setNav(false);
    cur = id;
    if (id === '*lexique') main.replaceChildren(lexique());
    else { const v = ficheView(id, { open, go: opts.go }); dispose = v.dispose; main.replaceChildren(v.node); }
    drawList();
    main.scrollTop = 0;
    const top = main.getBoundingClientRect().top;
    if (top < 0) main.scrollIntoView({ block: 'start' });
    try { history.replaceState(null, '', '#' + (id === '*lexique' ? 'lexique' : id)); } catch (e) { /* page sans historique */ }
  }
  // sur téléphone, la liste des notions se replie au-dessus de la fiche
  const narrow = matchMedia('(max-width: 760px)');
  const navBody = el('div', { class: 'co-navbody', id: 'co-navbody' }, search, list);
  const toggle = el('button', { type: 'button', class: 'btn small co-navtoggle', 'aria-controls': 'co-navbody', onclick: () => setNav(navBody.hidden) }, `Toutes les notions (${Object.keys(FICHES).length})`);
  function setNav(on) { navBody.hidden = !on; toggle.setAttribute('aria-expanded', String(on)); }
  narrow.addEventListener('change', () => setNav(!narrow.matches));
  const wrap = el('div', { class: 'co-wrap' },
    el('nav', { class: 'co-nav plate', 'aria-label': 'Les notions' }, toggle, navBody),
    main);
  setNav(!narrow.matches);
  const h = decodeURIComponent((location.hash || '').slice(1));
  open(h === 'lexique' ? '*lexique' : FICHES[h] || TERMS[h] ? h : (opts.start || 'sdi'));
  return wrap;
}
