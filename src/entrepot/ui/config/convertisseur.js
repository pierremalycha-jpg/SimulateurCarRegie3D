// @ts-check
import { CATALOGUE } from '../../catalogue/index.js';
import { section, note, choix, texte, reseau, services, suggestions, checkIp } from './kit.js';

// ----------------------------------------------------------------------------------
// Les menus des convertisseurs et interfaces Blackmagic : les Teranex Mini audio (la paire de
// voies embarquée ou désembarquée, l'entrée audio) et la GPI and Tally Interface (l'adresse de
// l'ATEM qu'elle écoute). Réglés dans Blackmagic Converters Setup et ATEM Setup. Clés lues par le
// moteur : paire, entree ('xlr' | 'aes' | 'rca' | 'optique'), atemIp, reseau.
// ----------------------------------------------------------------------------------
/** @typedef {import('./kit.js').Appareil} Appareil */
/** @typedef {import('./kit.js').Modele} Modele */
/** @typedef {import('./kit.js').Ctx} Ctx */

const PAIRES = /** @type {Array<[number, string]>} */ ([1, 2, 3, 4, 5, 6, 7, 8].map((p) => [p, `voies ${p * 2 - 1}-${p * 2}`]));

/** @param {Appareil} a @param {Modele} m @param {Ctx} ctx */
export function menuTeranex(a, m, ctx) {
  const c = a.cfg;
  const embed = m.ports.some((p) => (p.sig === 'audio' || p.sig === 'aes') && p.dir === 'in');
  const entrees = /** @type {Array<[string, string]>} */ ([]);
  if (m.ports.some((p) => p.dir === 'in' && /xlr/.test(p.kind) && p.sig === 'audio')) entrees.push(['xlr', 'XLR analogiques']);
  if (m.ports.some((p) => p.dir === 'in' && p.sig === 'aes' && p.kind !== 'toslink')) entrees.push(['aes', 'AES/EBU']);
  if (m.ports.some((p) => p.dir === 'in' && p.kind === 'rca')) entrees.push(['rca', 'RCA']);
  if (m.ports.some((p) => p.dir === 'in' && p.kind === 'toslink')) entrees.push(['optique', 'Optique (TOSLINK)']);
  return [
    section(embed ? 'Embarquer le son' : 'Désembarquer le son',
      note(embed ? 'Le Teranex Audio to SDI remplace une paire de voies du flux SDI par son entrée audio : le micro de la salle part avec l\'image, dans le programme.' : 'Le Teranex SDI to Audio sort une paire de voies du flux SDI sur ses prises audio : la sonorisation de la salle, un enregistreur audio. La vidéo ressort sur la boucle SDI.'),
      choix(a.uid, 'paire', Number(c.paire) || 1, PAIRES, embed ? 'Paire remplacée' : 'Paire sortie', { aide: 'Les micros d\'un programme sont d\'habitude sur les voies 1-2.' }),
      embed && entrees.length ? choix(a.uid, 'entree', c.entree || 'xlr', entrees, 'Entrée audio') : null,
      ...services(ctx, `${a.uid}:audio`)),
    reseau(a, ctx, { menu: 'Blackmagic Converters Setup (USB ou réseau) → Configure → Network.' }),
  ].filter(Boolean).map((x) => /** @type {HTMLElement} */ (x));
}

/** @param {Appareil} a @param {Modele} m @param {Ctx} ctx */
export function menuGpiTally(a, m, ctx) {
  const c = a.cfg; const dl = `ep-dl-atem-${a.uid}`;
  return [
    section('L\'ATEM écouté',
      note('L\'interface se connecte à l\'ATEM par le réseau (TCP 9910) et ferme son relais n quand l\'entrée n est au programme. Sa prise GPI / TALLY se câble sur TALLY/GPIO 1 du pupitre AW-RP150.'),
      suggestions(ctx, dl, (x, mo) => mo.famille === 'melangeur' && /atem/.test(mo.id)),
      texte(a.uid, 'atemIp', c.atemIp, 'Adresse de l\'ATEM', { mono: true, list: dl, check: checkIp, placeholder: 'l\'adresse effective de l\'ATEM', aide: 'ATEM Setup → GPI and Tally Interface → ATEM Switcher IP.' }),
      ...services(ctx, `${a.uid}:atem:`)),
    reseau(a, ctx, { menu: 'ATEM Setup (USB) → Network : l\'interface doit être dans le sous-réseau de l\'ATEM.' }),
  ];
}
export const estGpiTally = (/** @type {string} */ id) => !!CATALOGUE[id] && 'atemIp' in (CATALOGUE[id].cfg || {});
