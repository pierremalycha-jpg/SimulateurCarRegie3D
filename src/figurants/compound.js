// @ts-check
// ----------------------------------------------------------------------------------
// La vie du compound : des techniciens qui vont et viennent (le car, le groupe électrogène, le camion satellite,
// les bungalows de la production, le pied de car, le portail du stade), qui entrent dans le car et en ressortent,
// et des agents de sécurité (au portail, en ronde le long des grilles, à l'entrée du compound). Chacun suit un
// itinéraire en boucle : marcher vers un point, s'y arrêter (regard, geste), disparaître un moment (dans le stade).
// Coordonnées du monde (x, z) ; la scène (le stade ou l'intérieur du car) et la hauteur du sol (marches de la
// porte, plancher du car) se déduisent de la position. Calcul pur (avancerMarcheur) : tests/unit/figurants.test.mjs.
// ----------------------------------------------------------------------------------

/**
 * @typedef {{ vers: number[] } | { pause: number, cap?: number, bras?: 'croise' | 'radio' | 'ballants', penche?: number } | { cache: number }} Etape
 * @typedef {{ id: string, nom: string, metier: string, vitesse: number, etapes: Etape[], tenue: import('./troupe.js').Tenue, depart?: number }} Marcheur
 */
// lieux du compound (et de l'intérieur du car)
export const LIEUX = {
  porteBas: [-17.25, -114.5], porteHaut: [-17.25, -116.95], dedans: [-17.25, -117.8], allee: [-17.25, -118.5],
  techAllee: [-13.7, -118.5], techCentre: [-13.7, -120.1], ccu: [-13.45, -120.75], grille: [-12.55, -120.75], brassage: [-11.7, -119.4], intercom: [-12.3, -118.75],
  prodAllee: [-20.6, -118.45],
  pied: [-11.0, -115.9], piedAbord: [-11.0, -113.4], devantCar: [-15.2, -113.3], estCar: [-6, -113.8],
  groupe: [17.6, -122.6], arriereCar: [-7.3, -118.6], cables: [2.6, -120.4],
  sat: [-48.6, -125.6], ouestCar: [-26, -112.4], bungalow: [24.2, -147.4], rampe: [2.9, -106], avantPortail: [-0.6, -101],
  portail: [1.0, -97.2], stade: [1.0, -93.2],
};
const L = LIEUX;
const PEAU = [0xf1c6a5, 0xe0ac86, 0xc68a62, 0x9c6b47, 0x7a4e30, 0x5a3a24];
// cheveux contrastés avec la peau : foncés sur les peaux mates, parfois châtain clair ou blond sur les peaux claires
const cheveuxPour = (k) => (k % 6 < 2 && k % 3 === 0 ? [0xa07a42, 0x6b4a2a][k % 2] : [0x1a1410, 0x0c0c0c, 0x2a1d14][k % 3]);
const tech = (haut, bas, k, extra = {}) => ({ haut, bas, peau: PEAU[k % 6], cheveux: cheveuxPour(k), ...extra });
// gilet haute visibilité : le haut fluo, le col et les manches sombres (le tee-shirt dessous)
const gilet = (fluo, k) => tech(fluo, 0x23262b, k, { col: 0x1b1d21, manches: 0x1b1d21, manchesLongues: true });

/** @type {Marcheur[]} */
export const MARCHEURS = [
  { id: 'video', nom: 'Lucas', metier: 'Technicien vidéo', vitesse: 1.35, tenue: tech(0x1b2a44, 0x23262b, 0),
    etapes: [{ vers: L.porteBas }, { vers: L.porteHaut }, { vers: L.dedans }, { vers: L.allee }, { vers: L.techAllee }, { vers: L.techCentre }, { vers: L.ccu }, { pause: 22, cap: Math.PI, penche: 0.12 }, { vers: L.grille }, { pause: 10, cap: Math.PI }, { vers: L.techCentre }, { vers: L.techAllee }, { vers: L.allee }, { vers: L.dedans }, { vers: L.porteHaut }, { vers: L.porteBas }, { vers: L.devantCar }, { vers: L.piedAbord }, { vers: L.pied }, { pause: 12, cap: Math.PI, penche: 0.3 }, { vers: L.piedAbord }, { vers: L.devantCar }] },
  { id: 'electricien', nom: 'Karim', metier: 'Électricien', vitesse: 1.25, tenue: gilet(0xff7a1a, 1), depart: 3,
    etapes: [{ vers: L.groupe }, { pause: 18, cap: Math.PI, bras: 'radio' }, { vers: L.cables }, { pause: 5, cap: -Math.PI / 2, penche: 0.35 }, { vers: L.arriereCar }, { pause: 14, cap: -Math.PI / 2 }, { vers: L.cables }, { vers: [10, -121.2] }] },
  { id: 'sat', nom: 'Émilie', metier: 'Liaison satellite', vitesse: 1.3, tenue: tech(0x2f3338, 0x1d2129, 2, { manchesLongues: true }), depart: 6,
    etapes: [{ vers: L.sat }, { pause: 24, cap: Math.PI, penche: 0.15 }, { vers: L.ouestCar }, { vers: L.porteBas }, { vers: L.porteHaut }, { vers: L.dedans }, { vers: L.allee }, { vers: L.techAllee }, { vers: L.intercom }, { pause: 14, cap: 0 }, { vers: L.techAllee }, { vers: L.allee }, { vers: L.dedans }, { vers: L.porteHaut }, { vers: L.porteBas }, { vers: L.ouestCar }] },
  { id: 'cadreur', nom: 'Hugo', metier: 'Cadreur', vitesse: 1.4, tenue: tech(0x16181b, 0x16181b, 3, { manchesLongues: true, casque: false }), depart: 2,
    etapes: [{ vers: L.porteBas }, { vers: L.devantCar }, { vers: L.rampe }, { vers: L.avantPortail }, { vers: L.portail }, { vers: L.stade }, { cache: 70 }, { vers: L.portail }, { vers: L.avantPortail }, { vers: L.rampe }, { vers: L.devantCar }, { vers: L.porteBas }, { vers: L.porteHaut }, { vers: L.dedans }, { vers: L.allee }, { pause: 9, cap: Math.PI }, { vers: L.dedans }, { vers: L.porteHaut }] },
  { id: 'assistante', nom: 'Sarah', metier: 'Assistante de production', vitesse: 1.3, tenue: tech(0x8a1c2b, 0x23262b, 4), depart: 9,
    etapes: [{ vers: L.bungalow }, { pause: 16, cap: Math.PI }, { vers: [8, -128] }, { vers: L.estCar }, { vers: L.devantCar }, { vers: L.porteBas }, { vers: L.porteHaut }, { vers: L.dedans }, { vers: L.allee }, { vers: L.prodAllee }, { pause: 18, cap: Math.PI, bras: 'croise' }, { vers: L.allee }, { vers: L.dedans }, { vers: L.porteHaut }, { vers: L.porteBas }, { vers: L.devantCar }, { vers: L.estCar }, { vers: [8, -128] }] },
  { id: 'runner', nom: 'Julien', metier: 'Runner', vitesse: 1.5, tenue: tech(0x2b2b2b, 0x1d2129, 5, { manchesLongues: true }), depart: 1,
    etapes: [{ vers: L.bungalow }, { pause: 8, cap: Math.PI }, { vers: [8, -118] }, { vers: L.rampe }, { vers: L.avantPortail }, { vers: L.portail }, { vers: L.stade }, { cache: 45 }, { vers: L.portail }, { vers: L.avantPortail }, { vers: L.rampe }, { vers: [8, -118] }] },
  // la sécurité : au portail du stade (contrôle des accréditations), en ronde le long des grilles, à l'entrée
  { id: 'securite-portail', nom: 'Agent de sécurité', metier: 'Sécurité', vitesse: 1, tenue: gilet(0xd7f000, 6),
    etapes: [{ vers: [-0.6, -97.6] }, { pause: 30, cap: Math.PI, bras: 'croise' }, { pause: 6, cap: Math.PI - 0.5, bras: 'radio' }, { pause: 25, cap: Math.PI + 0.3, bras: 'croise' }] },
  { id: 'securite-ronde', nom: 'Agent de sécurité', metier: 'Sécurité', vitesse: 1.05, tenue: gilet(0xd7f000, 7), depart: 2,
    etapes: [{ vers: [-38.5, -98.8] }, { pause: 8, cap: Math.PI / 2, bras: 'radio' }, { vers: [-12, -98.8] }, { vers: [36, -98.8] }, { pause: 10, cap: -Math.PI / 2, bras: 'croise' }, { vers: [-12, -98.8] }] },
  { id: 'securite-entree', nom: 'Agent de sécurité', metier: 'Sécurité', vitesse: 1, tenue: gilet(0xff8a1f, 8),
    etapes: [{ vers: [-36, -108] }, { pause: 40, cap: Math.PI / 2 + 0.4, bras: 'croise' }, { pause: 5, cap: Math.PI / 2, bras: 'radio' }] },
];

/** l'état de départ d'un marcheur : posé sur un point de son itinéraire (décalé pour que tous ne partent pas ensemble) */
export function departMarcheur(m) {
  const k0 = (m.depart || 0) % m.etapes.length;
  let p = null; for (let k = k0; k >= 0 && !p; k--) { const e = m.etapes[k]; if ('vers' in e) p = e.vers; }
  if (!p) for (const e of m.etapes) if ('vers' in e) { p = e.vers; break; }
  return { k: k0, x: p[0], z: p[1], cap: Math.PI, t: 0, phase: 0, vitesse: 0, cache: false, bras: /** @type {any} */ ('ballants'), penche: 0 };
}
/**
 * Un pas d'un marcheur : il avance vers le point de l'étape, s'arrête le temps d'une pause, ou reste caché.
 * @param {Marcheur} m @param {ReturnType<typeof departMarcheur>} e @param {number} dt
 */
export function avancerMarcheur(m, e, dt) {
  let reste = dt, garde = 0;
  while (reste > 1e-6 && garde++ < 8) {
    const et = m.etapes[e.k];
    if ('vers' in et) {
      const dx = et.vers[0] - e.x, dz = et.vers[1] - e.z, d = Math.hypot(dx, dz);
      e.cache = false; e.bras = 'marche'; e.penche = 0;
      if (d < 1e-3) { e.k = (e.k + 1) % m.etapes.length; e.t = 0; continue; }
      const pas = m.vitesse * reste;
      if (pas >= d) { e.x = et.vers[0]; e.z = et.vers[1]; reste -= d / m.vitesse; e.k = (e.k + 1) % m.etapes.length; e.t = 0; }
      else { e.x += dx / d * pas; e.z += dz / d * pas; reste = 0; }
      e.cap = Math.atan2(dx, dz); e.vitesse = m.vitesse; e.phase += dt * (2.2 + m.vitesse * 1.6);
    } else {
      const duree = 'pause' in et ? et.pause : et.cache;
      e.vitesse = 0; e.cache = 'cache' in et;
      if ('pause' in et) { if (et.cap != null) e.cap = et.cap; e.bras = et.bras || 'ballants'; e.penche = et.penche || 0; }
      if (e.t + reste < duree) { e.t += reste; reste = 0; } else { reste -= duree - e.t; e.t = 0; e.k = (e.k + 1) % m.etapes.length; }
    }
  }
  return e;
}
