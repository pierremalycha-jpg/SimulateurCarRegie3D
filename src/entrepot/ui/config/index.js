// @ts-check
import { el } from '../../../util.js';
import { menuCamera } from './camera.js';
import { menuPupitre } from './pupitre.js';
import { menuMelangeur } from './melangeur.js';
import { menuEnregistreur } from './enregistreur.js';
import { menuTeranex, menuGpiTally } from './convertisseur.js';
import { menuSwitch, menuRouteur } from './reseau.js';
import { menuPc } from './ordinateur.js';
import { menuDivers } from './divers.js';
import { reseau } from './kit.js';

// ----------------------------------------------------------------------------------
// Les menus de configuration de l'entrepôt : un menu par sorte d'appareil, choisi d'après la
// famille du modèle et sa configuration d'usine (la même règle que le moteur, engine.js). Un
// appareil inconnu de ces menus garde au moins sa section « Réseau » s'il a une adresse.
// ----------------------------------------------------------------------------------
/** @typedef {import('./kit.js').Appareil} Appareil */
/** @typedef {import('./kit.js').Modele} Modele */
/** @typedef {import('./kit.js').Ctx} Ctx */

/** @param {Appareil} a @param {Modele} m @param {Ctx} ctx @returns {HTMLElement[]} */
export function renderConfig(a, m, ctx) {
  const c = a.cfg || {};
  if (m.famille === 'camera') return menuCamera(a, m, ctx);
  if (m.famille === 'pupitre' && Array.isArray(c.cameras)) return menuPupitre(a, m, ctx);
  if (m.famille === 'melangeur') return menuMelangeur(a, m, ctx);
  if (m.famille === 'enregistreur') return menuEnregistreur(a, m, ctx);
  if ('atemIp' in c) return menuGpiTally(a, m, ctx);
  if (m.famille === 'convertisseur' && c.paire != null) return menuTeranex(a, m, ctx);
  if (m.famille === 'reseau' && c.ports && typeof c.ports === 'object') return menuSwitch(a, m, ctx);
  if (m.famille === 'reseau' && c.lan) return menuRouteur(a, m, ctx);
  if (m.famille === 'ordinateur') return menuPc(a, m, ctx);
  if (['alimentation', 'moniteur', 'son', 'accessoire'].includes(m.famille)) return menuDivers(a, m, ctx);
  return c.reseau ? [reseau(a, ctx)] : [el('p', { class: 'note' }, 'Rien à régler sur cet appareil.')];
}
