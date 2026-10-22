// @ts-check
import { el } from '../../util.js';
import { parFamille } from '../catalogue/index.js';
import { sortir } from '../build.js';

// ----------------------------------------------------------------------------------
// Le stock : les rayons de l'entrepôt, famille par famille ; chaque modèle a sa fiche courte et
// un bouton « Sortir ». Le rédacteur « panneaux » enrichit ce fichier (recherche, fiche détaillée,
// prix, ce qui est déjà sorti) ; ci-dessous la version de base qui fait tourner le module.
// ----------------------------------------------------------------------------------
/** @typedef {{ B: import('../types.js').Build, E: import('../types.js').Eval, open: (uid: string) => void, panel: (n: string) => void, close: () => void, say: (t: string) => void }} Ctx */

/** @param {Ctx} ctx */
export function renderStock(ctx) {
  const box = el('div', { class: 'ep-stock' });
  for (const f of parFamille()) {
    const sec = el('section', { class: 'ep-rayon' }, el('h3', {}, f.nom));
    for (const m of f.modeles) {
      if (m.pose === 'mur') continue;
      const n = ctx.B.appareils.filter((a) => a.modele === m.id).length;
      sec.append(el('div', { class: 'ep-item' },
        el('div', { class: 'ep-item-t' }, el('b', {}, m.nom), el('small', {}, `${m.marque}${m.prix ? ' · ≈ ' + m.prix.toLocaleString('fr-FR') + ' €' : ''}${n ? ' · ' + n + ' sorti' + (n > 1 ? 's' : '') : ''}`), el('p', {}, m.role)),
        el('button', { type: 'button', class: 'btn small primary', onclick: () => { const r = sortir(m.id); if (r.ok && r.uid) ctx.open(r.uid); else ctx.say(r.why || 'Impossible.'); } }, 'Sortir')));
    }
    box.append(sec);
  }
  return box;
}
