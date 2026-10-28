// @ts-check
// ----------------------------------------------------------------------------------
// L'équipe du car : chacun à son poste, assis sur le siège du pupitre (truck.js). Les rôles que l'équipe
// virtuelle tient pendant l'émission (emission/ia.js, ROLES_IA) ont ici un visage ; la production, le chef de
// car et la régie HF complètent l'équipe. Quand on s'assoit à un poste, son titulaire se lève, passe derrière les
// bureaux et attend debout contre la paroi de l'allée, bras croisés, en regardant le mur d'écrans ; il revient
// s'asseoir quand on s'en va. Coordonnées locales au car : lx, lz depuis le centre (TRUCK.cx, TRUCK.cz).
// Calcul pur (avancerEquipier) : testé dans tests/unit/figurants.test.mjs.
// ----------------------------------------------------------------------------------

/**
 * @typedef {object} Equipier
 * @property {string} id @property {string} station le poste de truck.js (son siège est le plus proche)
 * @property {string} role le rôle de l'équipe virtuelle (emission/ia.js), '' s'il n'y en a pas
 * @property {string} nom @property {string} metier
 * @property {'bureau' | 'console' | 'pointe' | 'croise'} geste ce que font ses mains au pupitre
 * @property {number[][]} chemin du siège à l'attente (lx, lz), dernier point : l'attente
 * @property {import('./troupe.js').Tenue} tenue
 */
const PEAU = [0xf1c6a5, 0xe0ac86, 0xc68a62, 0x9c6b47, 0x7a4e30, 0x5a3a24];
// cheveux contrastés avec la peau (foncés, sauf quelques châtains clairs et blonds sur les peaux claires)
const cheveux = (k) => (k % 6 < 2 && k % 4 === 0 ? [0xa07a42, 0x6b4a2a][k % 2] : [0x1a1410, 0x0c0c0c, 0x2a1d14][k % 3]);
const tenue = (haut, bas, k, extra = {}) => ({ haut, bas, peau: PEAU[k % 6], cheveux: cheveux(k), casque: true, ...extra });
// derrière les bureaux de production par le passage entre les deux rangées (lx ≈ −0,2), ou par le côté
// technique (lx ≈ 4) pour la vision de droite ; l'attente est contre la paroi de l'allée (lz ≈ 2,2)
const PROD = (lx, x) => [[lx, -0.75], [-0.2, -0.75], [-0.2, 1.55], [x, 1.55], [x, 2.2]];
const ARR = (lx, x) => [[lx, 0.95], [lx, 1.55], [x, 1.55], [x, 2.2]];
/** @type {Equipier[]} */
export const EQUIPE = [
  { id: 'son', station: 'son', role: 'son', nom: 'Thomas', metier: 'Ingénieur du son', geste: 'console', chemin: [[-6.75, -0.4], [-6.4, 0.9], [-6.5, 2.0]], tenue: tenue(0x1d2129, 0x2a2f38, 0) },
  { id: 'scripte', station: 'scripte', role: 'scripte', nom: 'Claire', metier: 'Scripte', geste: 'bureau', chemin: PROD(-4.3, -4.8), tenue: tenue(0x5a3d6e, 0x23262b, 1) },
  { id: 'realisateur', station: 'realisateur', role: 'realisateur', nom: 'Marc', metier: 'Réalisateur', geste: 'pointe', chemin: PROD(-2.9, -3.3), tenue: tenue(0x111214, 0x23262b, 2, { manchesLongues: true }) },
  { id: 'truquiste', station: 'melangeur', role: 'truquiste', nom: 'Nadia', metier: 'Truquiste', geste: 'console', chemin: PROD(-1.3, -1.6), tenue: tenue(0x2b3b52, 0x1d2129, 3) },
  { id: 'habillage', station: 'habillage', role: 'habillage', nom: 'Inès', metier: 'Habillage', geste: 'bureau', chemin: ARR(-4.3, -4.1), tenue: tenue(0x8a2b4a, 0x23262b, 4) },
  { id: 'production', station: 'producteur', role: '', nom: 'Paul', metier: 'Producteur', geste: 'croise', chemin: ARR(-2.9, -2.6), tenue: tenue(0x3a4250, 0x23262b, 5, { manchesLongues: true }) },
  { id: 'chefdecar', station: 'chefdecar', role: '', nom: 'Olivier', metier: 'Chef de car', geste: 'bureau', chemin: ARR(-1.75, -0.9), tenue: tenue(0x1b2a44, 0x2a2f38, 6) },
  { id: 'vision1', station: 'vision1', role: 'vision', nom: 'Sami', metier: 'Ingénieur vision', geste: 'console', chemin: PROD(1.1, 1.9), tenue: tenue(0x24321c, 0x23262b, 7) },
  { id: 'vision2', station: 'vision2', role: 'vision', nom: 'Julie', metier: 'Ingénieure vision', geste: 'console', chemin: [[2.8, -0.75], [4.0, -0.75], [4.0, 1.55], [3.4, 1.55], [3.4, 2.2]], tenue: tenue(0x2a2f38, 0x1d2129, 8) },
  { id: 'lsm', station: 'evsA', role: 'ralentis', nom: 'Hugo', metier: 'Opérateur ralentis (LSM)', geste: 'console', chemin: ARR(1.5, 2.6), tenue: tenue(0x3b2a1a, 0x23262b, 9) },
  { id: 'ipdirector', station: 'evsB', role: 'ipdirector', nom: 'Léa', metier: 'IPDirector, médias', geste: 'bureau', chemin: ARR(3.0, 4.1), tenue: tenue(0x1d3a5a, 0x2a2f38, 10) },
  { id: 'hf', station: 'hf', role: '', nom: 'Yanis', metier: 'Technicien HF', geste: 'bureau', chemin: [[7.75, -0.45], [6.6, -0.2], [6.6, 0.2]], tenue: tenue(0x2c2f34, 0x1d2129, 11) },
];

/** longueur d'un chemin */
export const longueur = (ch) => { let L = 0; for (let k = 1; k < ch.length; k++) L += Math.hypot(ch[k][0] - ch[k - 1][0], ch[k][1] - ch[k - 1][1]); return L; };
/** le point à la distance s le long du chemin, et la direction de la marche (cap, radians) */
export function pointSur(ch, s) {
  let r = Math.max(0, s);
  for (let k = 1; k < ch.length; k++) {
    const dx = ch[k][0] - ch[k - 1][0], dz = ch[k][1] - ch[k - 1][1], l = Math.hypot(dx, dz);
    if (r <= l || k === ch.length - 1) { const u = l > 0 ? Math.min(1, r / l) : 1; return { x: ch[k - 1][0] + dx * u, z: ch[k - 1][1] + dz * u, cap: Math.atan2(dx, dz) }; }
    r -= l;
  }
  return { x: ch[0][0], z: ch[0][1], cap: 0 };
}

export const VITESSE = 1.1; // m/s dans le car
export const LEVER = 0.9; // s pour se lever (ou s'asseoir)
/**
 * Un pas de l'équipier : s'il doit laisser sa place (occupe), il se lève puis marche jusqu'à l'attente ; sinon il
 * revient et se rassoit. État : s (distance parcourue depuis le siège), assis (0 à 1), sens (+1 il part, −1 il revient).
 * @param {{ s: number, assis: number, sens?: number }} e @param {number} L longueur du chemin @param {boolean} occupe @param {number} dt
 */
export function avancerEquipier(e, L, occupe, dt) {
  if (occupe) {
    if (e.assis > 0) { e.assis = Math.max(0, e.assis - dt / LEVER); e.sens = 0; return e; }
    e.sens = e.s < L ? 1 : 0; e.s = Math.min(L, e.s + VITESSE * dt);
  } else if (e.s > 0) { e.sens = -1; e.s = Math.max(0, e.s - VITESSE * dt); }
  else { e.sens = 0; e.assis = Math.min(1, e.assis + dt / LEVER); }
  return e;
}
