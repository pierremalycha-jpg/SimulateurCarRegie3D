// @ts-check
// ----------------------------------------------------------------------------------
// Catalogue, groupe « divers » : l'énergie (prises murales, bandeau secteur, blocs 12 V), les
// supports (pieds), les moniteurs, un micro, et ce qu'il faut pour qu'un montage tienne debout.
// Les deux premiers modèles (la prise murale et le bandeau secteur) sont le gabarit d'un modèle :
// ports, faces, consommation, configuration d'usine. Le reste du groupe est écrit par le
// rédacteur « divers » (voir le brief).
// ----------------------------------------------------------------------------------
/** @typedef {import('../types.js').Modele} Modele */
/** @typedef {import('../types.js').Port} Port */
/** @typedef {import('../types.js').FaceItem} FaceItem */

/** une rangée de ports sur une face (même utilitaire que equipment/devices.js) */
export function row(/** @type {FaceItem[]} */ items, /** @type {string[]} */ ids, x0, y, dx, kind, /** @type {string[]} */ labels, extra = {}) {
  ids.forEach((id, i) => items.push({ t: 'port', id, k: kind, x: x0 + i * dx, y, l: labels ? labels[i] : id.toUpperCase(), ...extra }));
}

/** @type {Port[]} */
const MUR_PORTS = [1, 2, 3, 4].map((n) => ({ id: 'prise' + n, label: `Prise ${n}`, kind: /** @type {const} */ ('mur'), sig: /** @type {const} */ ('secteur'), dir: /** @type {const} */ ('out'), group: 'Secteur', desc: 'Prise murale 230 V, 16 A : le réseau électrique de l\'entrepôt. Un bandeau secteur ou un bloc d\'alimentation s\'y branche.' }));

/** @type {Record<string, Modele>} */
export const DIVERS = {
  mur: {
    id: 'mur', marque: 'Entrepôt', nom: 'Prises murales 230 V', court: 'Mur', famille: 'alimentation', pose: 'mur',
    role: 'Le tableau électrique de l\'entrepôt : quatre prises 16 A sur un disjoncteur de 16 A (3 680 W au plus pour l\'ensemble).',
    ports: MUR_PORTS, watts: 0, prix: 0,
    cfg: {},
    faces: {
      avant: { label: 'Prises', w: 520, h: 150, items: [
        { t: 'body', x: 10, y: 10, w: 500, h: 130, r: 8 }, { t: 'text', x: 24, y: 36, s: 'TABLEAU · PRISES 16 A · DISJONCTEUR 16 A (3 680 W)', size: 13 },
        ...(() => { /** @type {FaceItem[]} */ const it = []; row(it, MUR_PORTS.map((p) => p.id), 70, 90, 120, 'iec', MUR_PORTS.map((p) => p.label)); return it; })(),
      ] },
    },
    specs: ['Quatre prises sur un même disjoncteur de 16 A : 3 680 W pour l\'ensemble (ordre de grandeur, P = U × I = 230 × 16).'],
    boite: { w: 0.4, h: 0.3, d: 0.05, couleur: '#dfe3e6' },
  },
  bandeau: {
    id: 'bandeau', marque: 'Générique', nom: 'Bandeau secteur 19" 8 prises', court: 'Bandeau 230 V', famille: 'alimentation', pose: 'rack', u: 1, largeur: 1,
    role: 'Un bandeau de huit prises pour la baie : un seul cordon vers le mur, un interrupteur, 10 A au plus (2 300 W).',
    ports: [
      { id: 'in', label: 'ENTRÉE 230 V', kind: 'iec', sig: 'secteur', dir: 'in', group: 'Secteur', desc: 'Le cordon vers la prise murale (10 A).' },
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => /** @type {Port} */ ({ id: 'out' + n, label: `PRISE ${n}`, kind: 'iec', sig: 'secteur', dir: 'out', group: 'Prises', desc: 'Une prise 230 V pour un appareil de la baie (cordon IEC C13).' })),
    ],
    watts: 0, prix: 60,
    cfg: { interrupteur: true },
    faces: {
      arriere: { label: 'Face arrière', w: 760, h: 150, items: [
        { t: 'body', x: 10, y: 10, w: 740, h: 130, r: 6 }, { t: 'text', x: 24, y: 36, s: 'BANDEAU SECTEUR 19" · 8 × IEC C13 · 10 A', size: 13 },
        { t: 'port', id: 'in', k: 'iec', x: 60, y: 90, l: 'ENTRÉE' },
        ...(() => { /** @type {FaceItem[]} */ const it = []; row(it, [1, 2, 3, 4, 5, 6, 7, 8].map((n) => 'out' + n), 150, 90, 78, 'iec', [1, 2, 3, 4, 5, 6, 7, 8].map((n) => 'PRISE ' + n)); return it; })(),
      ] },
      avant: { label: 'Face avant', w: 760, h: 110, items: [
        { t: 'body', x: 10, y: 10, w: 740, h: 90, r: 6 }, { t: 'text', x: 24, y: 36, s: 'BANDEAU SECTEUR 19"', size: 13 },
        { t: 'sw', id: 'interrupteur', x: 700, y: 60, l: 'MARCHE' }, { t: 'led', id: 'led', x: 650, y: 55, l: '230 V' },
      ] },
    },
    specs: ['Huit prises IEC C13, un interrupteur lumineux, 10 A (2 300 W) : au-delà, le fusible du bandeau saute.'],
    boite: { w: 0.483, h: 0.044, d: 0.1, couleur: '#2b2f33' },
  },
};
