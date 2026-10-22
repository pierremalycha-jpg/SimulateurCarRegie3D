// @ts-check
import { el } from '../../util.js';
import { CATALOGUE, SIGNAUX } from '../catalogue/index.js';
import { appareil, debrancher } from '../build.js';

// ----------------------------------------------------------------------------------
// Le synoptique : tout le câblage en 2D (chaque appareil avec ses connecteurs, les câbles entre
// eux, en couleur du signal, en rouge quand la liaison est fausse). Le rédacteur « panneaux »
// écrit la version SVG (voir le brief) ; ci-dessous une liste, pour que le module tourne.
// ----------------------------------------------------------------------------------
/** @typedef {import('./stock.js').Ctx} Ctx */

/** @param {Ctx} ctx */
export function renderSynoptique(ctx) {
  const box = el('div', { class: 'ep-syno' });
  if (!ctx.B.cables.length) { box.append(el('p', { class: 'note' }, 'Aucun câble pour l\'instant. Ouvrez un appareil et cliquez sur un connecteur pour prendre un câble.')); return box; }
  const ul = el('ul', { class: 'ep-cables' });
  for (const c of ctx.B.cables) {
    const A = appareil(c.a.dev), Bb = appareil(c.b.dev); const st = ctx.E.cables[c.uid];
    const lab = (/** @type {import('../types.js').Bout} */ b, /** @type {any} */ a) => { const m = a ? CATALOGUE[a.modele] : null; const p = m ? m.ports.find((x) => x.id === b.port) : null; return `${a ? a.nom : '?'} · ${p ? p.label : b.port}`; };
    ul.append(el('li', { class: st && !st.ok ? 'ko' : '', style: `--c:${SIGNAUX[c.sig].couleur}` }, el('i', { 'aria-hidden': 'true' }), el('span', {}, `${lab(c.a, A)} ⟷ ${lab(c.b, Bb)}`, el('small', {}, ` ${SIGNAUX[c.sig].nom}${st && !st.ok ? ' · ' + st.why : ''}`)), el('button', { type: 'button', class: 'linkbtn', onclick: () => debrancher(c.uid) }, 'Débrancher')));
  }
  box.append(ul);
  return box;
}
