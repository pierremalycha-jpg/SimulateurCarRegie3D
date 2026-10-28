// @ts-check
// ----------------------------------------------------------------------------------
// L'adversaire du soir : à chaque partie au car régie, un club de Ligue 1 (data/clubs.js) tiré au sort ou choisi
// dans Jouer. Ses couleurs habillent les joueurs (people.js) et le parcage visiteurs (world.js), son nom passe
// dans le bandeau du score, l'habillage et les commentaires (ils lisent TEAMS). En coopération, l'hôte le
// transmet avec le match : les suiveurs voient le même adversaire.
// ----------------------------------------------------------------------------------
import { TEAMS, setAdversaire } from './data/match.js';
import { clubAuHasard, clubById } from './data/clubs.js';
import { peindreTenues } from './people.js';
import { peindreVisiteurs } from './world.js';
import { GFX } from './gfx.js';
import { emit } from './state.js';
import { registerSnapExtra } from './multi/session.js';

/**
 * Change l'adversaire : un identifiant de club, ou « hasard » (ou rien) pour un tirage au sort.
 * @param {string} [id]
 * @returns {import('./data/clubs.js').Club | null}
 */
export function choisirAdversaire(id) {
  const c = (id && id !== 'hasard' && clubById(id)) || clubAuHasard();
  if (!setAdversaire(c.id)) return null;
  peindreTenues(); peindreVisiteurs();
  GFX.title = `${TEAMS[0].name} – ${TEAMS[1].name}`; GFX.bug.last = '';
  emit('adversaire', c);
  return c;
}
// coopération : l'adversaire de l'hôte
registerSnapExtra('adv', () => TEAMS[1].id, (id) => { if (typeof id === 'string' && id !== TEAMS[1].id && clubById(id)) choisirAdversaire(id); });
