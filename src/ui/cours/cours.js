// @ts-check
import { el } from '../../util.js';
import { icon } from '../icons.js';
import { FICHES, THEMES, familles, themeDe } from '../../content/cours/index.js';
import { TERMS } from '../../content/netterms.js';
import { ficheView, ficheTitle, ficheShort, ficheKind } from './fiche.js';

// ----------------------------------------------------------------------------------
// La section Cours : à gauche la bibliothèque des notions par thème (et la recherche), à droite
// la fiche ouverte. Chaque thème range d'abord ses notions de cours, puis les fiches du lexique
// par famille ; le thème et la famille de la fiche ouverte se déplient seuls, les autres restent
// pliés. Une LED dit l'état de chaque fiche : verte, avec manipulation ; ambre, fiche du
// lexique ; éteinte, en préparation.
// ----------------------------------------------------------------------------------
const KIND = { lab: ['green', 'avec manipulation'], term: ['amber', 'fiche du lexique'], prevu: ['', 'en préparation'] };
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** toutes les fiches : les notions de cours, puis celles du lexique */
export const allIds = () => [...Object.keys(FICHES).filter((k) => !FICHES[k].term), ...Object.keys(TERMS)];

/**
 * @param {{ go: (target: { label: string, station?: string, lesson?: string, ip?: boolean }) => void, start?: string, hash?: boolean }} opts
 *   go : « Emmène-moi » et parcours du chef ; start : fiche ouverte d'abord ; hash : la fiche ouverte
 *   s'écrit dans l'adresse de la page (#sdi) et s'y relit (maquette seule)
 * @returns {{ node: HTMLElement, dispose: () => void }}
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
  // thèmes et familles dépliés à la main (en plus de ceux de la fiche ouverte)
  const unfolded = new Set();
  const fold = (key, cls, open, summary, ...content) => {
    const d = /** @type {HTMLDetailsElement} */ (el('details', { class: cls, 'data-k': key }, summary, ...content));
    d.open = open;
    // un clic (ou Entrée) sur l'intitulé : ce qu'on vient de déplier ou de replier à la main
    summary.addEventListener('click', () => { if (d.open) unfolded.delete(key); else unfolded.add(key); });
    return d;
  };
  const drawList = () => {
    const q = norm(search.value.trim());
    if (q) {
      const ids = allIds().filter((k) => norm(ficheTitle(k) + ' ' + ficheShort(k) + ' ' + ((TERMS[k] && TERMS[k].aka) || '')).includes(q));
      list.replaceChildren(ids.length ? el('ul', { class: 'co-items' }, ...ids.slice(0, 40).map(item)) : el('p', { class: 'note' }, 'Aucune notion ne correspond.'));
      return;
    }
    const curTheme = themeDe(cur);
    list.replaceChildren(...THEMES.map((th) => {
      const fams = familles(th);
      const n = th.fiches.length + fams.reduce((a, f) => a + f.ids.length, 0);
      return fold(th.id, 'co-theme', th.id === curTheme || unfolded.has(th.id),
        el('summary', {}, el('h3', {}, icon(th.icon), el('span', {}, th.nom), el('small', {}, String(n)))),
        th.fiches.length ? el('ul', { class: 'co-items' }, ...th.fiches.map(item)) : null,
        // un thème fait d'une seule famille : ses fiches directement, sans second niveau
        ...(!th.fiches.length && fams.length === 1 ? [el('ul', { class: 'co-items' }, ...fams[0].ids.map(item))] : fams.map((f) => {
          const key = th.id + '/' + f.nom;
          return fold(key, 'co-fam', f.ids.includes(cur) || unfolded.has(key),
            el('summary', {}, el('span', {}, f.nom), el('small', {}, String(f.ids.length))),
            el('ul', { class: 'co-items' }, ...f.ids.map(item)));
        })));
    }));
  };
  search.addEventListener('input', drawList);
  function open(id) {
    dispose(); dispose = () => {};
    if (narrow.matches) setNav(false);
    cur = id;
    const v = ficheView(id, { open, go: opts.go }); dispose = v.dispose; main.replaceChildren(v.node);
    drawList();
    main.scrollTop = 0;
    const top = main.getBoundingClientRect().top;
    if (top < 0) main.scrollIntoView({ block: 'start' });
    // la fiche ouverte, visible dans la liste (seule la liste défile, pas la page)
    requestAnimationFrame(() => {
      const b = list.querySelector('.co-item[aria-current="true"]'), nav = b && b.closest('.co-nav');
      if (!b || !nav || narrow.matches) return;
      const r = b.getBoundingClientRect(), n = nav.getBoundingClientRect();
      if (r.top < n.top || r.bottom > n.bottom) nav.scrollTop += r.top - n.top - n.height / 3;
    });
    if (opts.hash) { try { history.replaceState(null, '', '#' + id); } catch (e) { /* page sans historique */ } }
  }
  // sur téléphone, la liste des notions se replie au-dessus de la fiche
  const narrow = matchMedia('(max-width: 760px)');
  const navBody = el('div', { class: 'co-navbody', id: 'co-navbody' }, search, list);
  const toggle = el('button', { type: 'button', class: 'btn small co-navtoggle', 'aria-controls': 'co-navbody', onclick: () => setNav(navBody.hidden) }, `Toutes les notions (${allIds().length})`);
  function setNav(on) { navBody.hidden = !on; toggle.setAttribute('aria-expanded', String(on)); }
  const onNarrow = () => setNav(!narrow.matches);
  narrow.addEventListener('change', onNarrow);
  const wrap = el('div', { class: 'co-wrap' },
    el('nav', { class: 'co-nav plate', 'aria-label': 'Les notions' }, toggle, navBody),
    main);
  setNav(!narrow.matches);
  const h = opts.hash ? decodeURIComponent((location.hash || '').slice(1)) : opts.start || '';
  open(FICHES[h] || TERMS[h] ? h : 'sdi');
  return { node: wrap, dispose: () => { dispose(); dispose = () => {}; narrow.removeEventListener('change', onNarrow); } };
}
