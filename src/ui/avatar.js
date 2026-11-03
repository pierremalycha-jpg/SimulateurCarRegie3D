// @ts-check
import { el } from '../util.js';
import { icon } from './icons.js';
import { objet } from '../game/cosmetiques.js';

// ----------------------------------------------------------------------------------
// L'avatar d'un joueur dans son cadre (v19.25) : une icône du métier sur un disque de couleur, entouré
// de l'anneau du cadre porté. Les couleurs viennent de game/cosmetiques.js ; la forme de styles/profil.css.
// Utilisé par la carte joueur (game/quest.js), le profil et le classement (ui/profil_ui.js).
// ----------------------------------------------------------------------------------
/** @param {{ avatar?: string, cadre?: string }} p @param {string} [cls] grand, petit, mini */
export function avatarEl(p, cls = '') {
  const a = objet('avatar', p.avatar || ''), c = objet('cadre', p.cadre || '');
  return el('span', { class: 'pf-av' + (cls ? ' ' + cls : '') + (c && c.id !== 'aucun' ? ' cadre' : ''), style: `--av1:${a.fond[0]};--av2:${a.fond[1]};--ring:${c ? c.anneau : 'transparent'}`, 'aria-hidden': 'true' },
    el('span', { class: 'pf-av-in' }, icon(a.ico)));
}
