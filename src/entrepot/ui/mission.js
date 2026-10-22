// @ts-check
import { el } from '../../util.js';
import { CATALOGUE } from '../catalogue/index.js';
import { noter, MISSIONS } from '../missions.js';
import { vider } from '../build.js';

// ----------------------------------------------------------------------------------
// Le cahier des charges : la commande du client, les contraintes, chaque exigence et son état
// (acquise, partielle, manquante, avec l'explication du moteur), le budget, la note. En bac à
// sable : le choix d'une mission. Le rédacteur « panneaux » enrichit (rapport exportable, bilan
// enregistré) ; ci-dessous la version de base.
// ----------------------------------------------------------------------------------
/** @typedef {import('./stock.js').Ctx} Ctx */

/** @param {import('../missions.js').Mission | null} m @param {Ctx} ctx */
export function renderMission(m, ctx) {
  const box = el('div', { class: 'ep-mission' });
  if (!m) {
    box.append(el('p', { class: 'lede' }, 'Bac à sable : aucune commande. Montez ce que vous voulez, ou prenez une mission.'));
    for (const x of MISSIONS) box.append(el('div', { class: 'ep-item' }, el('div', { class: 'ep-item-t' }, el('b', {}, x.titre), el('small', {}, `${x.client} · ${x.niveau} · ${x.duree}`), el('p', {}, x.brief)), el('button', { type: 'button', class: 'btn small primary', onclick: () => { vider(x.id); ctx.panel('mission'); } }, 'Prendre')));
    return box;
  }
  const N = noter(m, ctx.B, ctx.E, CATALOGUE);
  box.append(el('p', { class: 'ep-client' }, el('b', {}, m.client)), el('p', { class: 'lede' }, m.brief),
    el('h3', {}, 'Contraintes'), el('ul', { class: 'prose' }, ...m.contraintes.map((c) => el('li', {}, c))),
    el('h3', {}, 'Exigences'),
    N.items.length ? el('ul', { class: 'ep-exig' }, ...N.items.map((i) => el('li', { class: i.ok ? 'ok' : i.partiel ? 'part' : 'ko' }, el('i', { 'aria-hidden': 'true' }), el('span', {}, el('b', {}, i.label), el('small', {}, ` ${i.pts} pt${i.pts > 1 ? 's' : ''}`), i.why ? el('span', { class: 'why' }, i.why) : null)))) : el('p', { class: 'note' }, 'Les exigences de cette mission sont en cours d\'écriture.'),
    N.budget ? el('p', { class: 'ep-budget ' + (N.budget.ok ? 'ok' : 'ko') }, `Budget : ${N.budget.used.toLocaleString('fr-FR')} € sur ${N.budget.max.toLocaleString('fr-FR')} € (ordres de grandeur).`) : null,
    el('p', { class: 'ep-score' }, el('b', {}, `${N.score} / 100`)));
  return box;
}
