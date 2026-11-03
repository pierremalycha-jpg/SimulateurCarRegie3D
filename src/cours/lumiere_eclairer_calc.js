// @ts-check
import { SOURCES, eclairage, intensiteAxe, angleBorne, gradateur, profil } from '../labo/calc/photometrie.js';
import { flux, angleSolide, diametre, scintillement, uniformite } from '../labo/calc/lumiere.js';

// ----------------------------------------------------------------------------------
// Les calculs de la partie « Éclairer pour la caméra » du chapitre « La lumière » (v19.29) : les
// projecteurs, le plateau de télévision, le stade. Calcul pur, au-dessus de labo/calc/photometrie.js
// (intensité dans l'axe, profil du faisceau, gradateur, éclairage d'une source réglée) et de
// labo/calc/lumiere.js (familles de sources, angle solide, diamètre éclairé, scintillement,
// uniformité) : les leçons et le Labo disent les mêmes chiffres.
//   - Flux d'un faisceau et intensité dans l'axe : avec le profil de photometrie.js, I(α) = I₀ × 2^−(2α/θ)²,
//     le flux d'un faisceau étroit vaut ∫ I(α) dΩ = I₀ × π θ² ÷ (4 ln 2) = I₀ × Ω(θ) ÷ ln 2 (θ en radians,
//     Ω(θ) l'angle solide du cône d'angle θ). D'où I₀ = Φ × ln 2 ÷ Ω(θ). Approximation des petits angles :
//     au-delà de 50°, c'est un ordre de grandeur.
//   - Les projecteurs autres que ceux du Labo (découpe, PAR, lyre, boîte à lumière) : flux de la lampe
//     = puissance × efficacité moyenne de sa famille (lumiere.js), multiplié par la part qui sort de
//     l'optique (« rendement », ordre de grandeur) ; leur intensité se calcule par la formule ci-dessus.
//     Ce sont des ordres de grandeur, pas les mesures d'un modèle précis.
//   - La dureté d'une ombre : la taille apparente de la source vue du sujet, 2 arctan(S ÷ 2d) ; la
//     pénombre portée sur un fond à b mètres derrière le sujet vaut S × b ÷ d (triangles semblables).
//   - Le visage au plateau : la cellule est sur le visage, tournée vers la caméra ; une source décalée de
//     az degrés sur le côté et montée de el degrés arrive avec une incidence i telle que cos i = cos az × cos el.
//   - Le débouchage qu'il faut pour un rapport de contraste r : (Ep + Ed) ÷ Ed = r, d'où Ed = Ep ÷ (r − 1).
//   - Le scintillement d'une source sur le secteur 50 Hz : sa lumière varie à 100 Hz, avec une
//     profondeur m (part de la lumière qui ondule ; ordre de grandeur selon la source). L'ondulation
//     vue d'une image à l'autre vaut m × |sin(π f t) ÷ (π f t)| (lumiere.js) ; au ralenti, une fréquence
//     apparente F à la prise de vue devient F × cadence de lecture ÷ cadence de prise de vue.
//   - Le stade : un modèle simple de projecteurs LED groupés sur le toit ou sur des mâts, chacun visant
//     un point de la pelouse ; éclairement horizontal au sol et vertical, à 1 m du sol, sur un plan
//     tourné vers la caméra principale (le visage d'un joueur vu de la tribune). Les chiffres d'un vrai
//     stade sortent d'une étude d'éclairage : ceux-ci sont des ordres de grandeur.
// ----------------------------------------------------------------------------------
const rad = (a) => a * Math.PI / 180;
const deg = (a) => a * 180 / Math.PI;

/** l'intensité dans l'axe (cd) d'un faisceau de flux Φ (lm) et d'angle de faisceau θ (degrés), avec le profil de photometrie.js */
export const intensiteDuFlux = (phi, theta) => phi * Math.LN2 / angleSolide(theta);
/** le flux (lm) d'un faisceau d'intensité I₀ dans l'axe (cd) et d'angle θ (degrés) : l'inverse de intensiteDuFlux */
export const fluxDuFaisceau = (I0, theta) => I0 * angleSolide(theta) / Math.LN2;

/**
 * Une source au format de photometrie.js, construite depuis sa puissance, sa famille et la part du flux qui sort de l'optique.
 * @param {{ id: string, nom: string, type: 'halogene' | 'hmi' | 'led', famille: string, T: number, watts: number, rendement: number, angles: [number, number] }} p
 * @returns {import('../labo/calc/photometrie.js').Source}
 */
function sourceDe(p) {
  const phi = flux(p.watts, p.famille) * p.rendement;
  return { id: p.id, nom: p.nom, type: p.type, T: p.T, watts: p.watts, angles: p.angles, I: [intensiteDuFlux(phi, p.angles[0]), intensiteDuFlux(phi, p.angles[1])] };
}

/**
 * @typedef {object} Projecteur
 * @property {string} id
 * @property {string} nom
 * @property {string} court nom sur la touche de la manipulation
 * @property {import('../labo/calc/photometrie.js').Source} s la source (celle du Labo, ou calculée)
 * @property {string} [labo] l'identifiant de la source dans le Labo (SOURCES de photometrie.js)
 * @property {'doux' | 'net' | 'tres-doux'} bord le bord du faisceau
 * @property {number} taille la taille de la surface qui émet, vue du sujet (m) : lentille, réflecteur, panneau
 * @property {string} reglage ce qui se règle
 */
/** @type {Projecteur[]} */
export const PROJECTEURS = [
  { id: 'fresnel', nom: 'Fresnel 1 kW halogène', court: 'Fresnel', s: SOURCES.fresnel, labo: 'fresnel', bord: 'doux', taille: 0.15, reglage: 'faisceau du serré (spot) au large (flood) en avançant la lampe ; volets coupe-flux' },
  {
    id: 'decoupe', nom: 'Découpe 750 W halogène (zoom)', court: 'Découpe', bord: 'net', taille: 0.15, reglage: 'zoom, netteté du bord, couteaux, iris, gobo',
    // champ 25 à 50° : faisceau de 14 à 28° (angle de champ ≈ 1,82 × faisceau)
    s: sourceDe({ id: 'decoupe', nom: 'Découpe 750 W', type: 'halogene', famille: 'halogene', T: 3200, watts: 750, rendement: 0.45, angles: [14, 28] }),
  },
  {
    id: 'par', nom: 'PAR 64 1 kW (lampe medium)', court: 'PAR', bord: 'doux', taille: 0.2, reglage: 'rien : l\'angle est celui de la lampe, on change de lampe',
    s: sourceDe({ id: 'par', nom: 'PAR 64 1 kW', type: 'halogene', famille: 'halogene', T: 3200, watts: 1000, rendement: 0.55, angles: [20, 20] }),
  },
  { id: 'panneau', nom: 'Panneau LED bicolore 100 W', court: 'Panneau LED', s: SOURCES.led, labo: 'led', bord: 'tres-doux', taille: 0.3, reglage: 'niveau et température, sans changer de couleur ; angle fixe' },
  {
    id: 'boite', nom: 'Panneau LED dans une boîte à lumière de 90 cm', court: 'Boîte à lumière', bord: 'tres-doux', taille: 0.9, reglage: 'niveau ; la toile diffuse et perd environ la moitié de la lumière (ordre de grandeur)',
    s: { ...SOURCES.led, id: 'boite', nom: 'Boîte à lumière', angles: [90, 90], I: [intensiteDuFlux(fluxDuFaisceau(SOURCES.led.I[0], SOURCES.led.angles[0]) * 0.5, 90), intensiteDuFlux(fluxDuFaisceau(SOURCES.led.I[0], SOURCES.led.angles[0]) * 0.5, 90)] },
  },
  {
    id: 'lyre', nom: 'Lyre spot LED 600 W (zoom)', court: 'Lyre spot', bord: 'net', taille: 0.15, reglage: 'pan, tilt, zoom, couleur, gobos, à distance par le DMX',
    s: sourceDe({ id: 'lyre', nom: 'Lyre spot LED', type: 'led', famille: 'led', T: 6500, watts: 600, rendement: 0.4, angles: [6, 45] }),
  },
];
export const projecteurById = (/** @type {string} */ id) => PROJECTEURS.find((p) => p.id === id) || PROJECTEURS[0];

/**
 * L'éclairage d'un projecteur réglé : intensité dans l'axe, éclairement dans l'axe (lx), diamètres du faisceau (50 %) et du champ (10 %).
 * Les projecteurs du Labo passent par eclairage() de photometrie.js ; les autres suivent les mêmes lois.
 * @param {{ id: string, angle: number, d: number, niveau?: number }} p d : distance (m) ; niveau : gradateur, 0 à 1
 */
export function eclairageProjecteur(p) {
  const P = projecteurById(p.id), niveau = p.niveau ?? 1;
  const champ = (theta) => theta * Math.sqrt(Math.log2(10));
  if (P.labo) {
    const r = eclairage({ source: P.labo, angle: p.angle, niveau, d: p.d });
    return { I0: r.I0, E: r.E, theta: r.theta, champ: champ(r.theta), diametre: diametre(p.d, r.theta), diametreChamp: diametre(p.d, champ(r.theta)), T: r.T };
  }
  const S = P.s, theta = angleBorne(S, p.angle), g = gradateur(S, niveau);
  const I0 = intensiteAxe(S, theta) * g.flux;
  return { I0, E: p.d > 0 ? I0 / (p.d * p.d) : 0, theta, champ: champ(theta), diametre: diametre(p.d, theta), diametreChamp: diametre(p.d, champ(theta)), T: g.T };
}
/** l'éclairement (lx) à r mètres de l'axe, sur le plan perpendiculaire à l'axe à la distance d (profil de photometrie.js) */
export const eclairementHorsAxe = (Eaxe, theta, d, r) => Eaxe * profil(theta, d > 0 ? deg(Math.atan(r / d)) : 0) * Math.pow(Math.cos(Math.atan(r / Math.max(d, 1e-9))), 3);

/** la taille apparente (degrés) d'une source de S mètres vue à d mètres */
export const tailleApparente = (S, d) => (d > 0 ? 2 * deg(Math.atan(S / (2 * d))) : 180);
/** la largeur (m) de la pénombre portée sur un fond à b mètres derrière le sujet, source de S mètres à d mètres du sujet */
export const penombre = (S, d, b) => (d > 0 ? S * b / d : Infinity);
/** la dureté de l'ombre selon la taille apparente de la source (repères d'ordre de grandeur) */
export const durete = (angle) => (angle < 6 ? 'dure' : angle < 20 ? 'intermediaire' : 'douce');

/** l'angle d'incidence (degrés) sur un visage tourné vers la caméra, d'une source décalée de az degrés sur le côté et montée de el degrés */
export const incidenceVisage = (az, el) => deg(Math.acos(Math.min(1, Math.max(-1, Math.cos(rad(az)) * Math.cos(rad(el))))));
/** le débouchage (lx) qu'il faut, avec une principale Ep (lx), pour un rapport de contraste r ((Ep + Ed) ÷ Ed) */
export const debouchagePour = (Ep, r) => (r > 1 ? Ep / (r - 1) : Infinity);
/** la distance (m) où une source donne E lx, connaissant E₀ à d₀ (inverse du carré) */
export const distancePour = (E, E0, d0) => (E > 0 ? d0 * Math.sqrt(E0 / E) : Infinity);

// ---------------- le scintillement ----------------
/**
 * Les sources d'un stade et la part de leur lumière qui ondule à 100 Hz sur le secteur 50 Hz (profondeur m,
 * ordre de grandeur : elle dépend du modèle, du ballast ou de l'alimentation).
 * @type {Array<{ id: string, nom: string, court: string, m: number, note: string }>}
 */
export const SOURCES_STADE = [
  { id: 'hmi-mag', nom: 'Iodures métalliques, ballast magnétique', court: 'HMI, ballast magnétique', m: 0.5, note: 'l\'arc s\'éteint et se rallume à chaque alternance' },
  { id: 'led-simple', nom: 'LED, alimentation non lissée', court: 'LED non lissée', m: 0.3, note: 'le courant des diodes suit le secteur redressé' },
  { id: 'halogene', nom: 'Halogène', court: 'Halogène', m: 0.08, note: 'le filament chaud a de l\'inertie : il ondule peu' },
  { id: 'sans', nom: 'LED ou HMI « sans scintillement »', court: 'Sans scintillement', m: 0.005, note: 'alimentation lissée ou ballast électronique : la lumière est presque constante' },
];
export const sourceStadeById = (/** @type {string} */ id) => SOURCES_STADE.find((s) => s.id === id) || SOURCES_STADE[0];
/** la fréquence de l'ondulation de la lumière d'une source sur le secteur (Hz) : deux fois celle du secteur */
export const frequenceLumiere = (secteur = 50) => 2 * secteur;
/** au-delà, l'ondulation se voit sur l'image (ordre de grandeur) */
export const SEUIL_VISIBLE = 0.02;
/**
 * Le scintillement vu à l'image : source de profondeur m, pose t (s), cadence c (images/s), relu à `lecture` images/s.
 * @returns {{ residu: number, ondulation: number, apparente: number, auRalenti: number, ralenti: number, visible: boolean, pompage: boolean }}
 *   residu : part de l'ondulation qui passe la pose (0 à 1) ; ondulation : variation de lumière d'une image à l'autre (0 à 1) ;
 *   apparente : fréquence du battement à la prise de vue (Hz) ; auRalenti : celle que voit le téléspectateur à la lecture (Hz) ;
 *   ralenti : facteur de ralenti ; visible : un battement se voit ; pompage : la cadence tombe juste sur la lumière (pas de
 *   battement rapide), mais l'ondulation n'est pas effacée : la moindre dérive du secteur (il n'est jamais à 50,000 Hz) la
 *   fait lentement monter et descendre
 */
export function scintillementVu(m, t, c, lecture = 50, secteur = 50) {
  const s = scintillement(frequenceLumiere(secteur), t, c);
  const ondulation = m * s.residu, ralenti = c / lecture, forte = ondulation > SEUIL_VISIBLE;
  return { residu: s.residu, ondulation, apparente: s.apparente, auRalenti: s.apparente / ralenti, ralenti, visible: forte && s.apparente > 0.01, pompage: forte && s.apparente <= 0.01 };
}

/**
 * La lumière moyenne d'une image exposée de a à a + t secondes, sous une lumière 1 + m sin(2π f τ) (1 = la moyenne) :
 * 1 + m (cos 2πfa − cos 2πf(a + t)) ÷ (2πf t). D'une image à l'autre, elle varie de ± m × |sin(πft) ÷ (πft)| autour de 1.
 */
export function imageMoyenne(m, f, a, t) {
  const w = 2 * Math.PI * f;
  if (t <= 0 || w * t < 1e-9) return 1 + m * Math.sin(w * a);
  return 1 + m * (Math.cos(w * a) - Math.cos(w * (a + t))) / (w * t);
}

// ---------------- le stade ----------------
/** la pelouse (m) : 105 × 68, centrée sur l'origine ; x le long du terrain, y en largeur (la tribune principale est du côté y < 0) */
export const PELOUSE = { L: 105, l: 68 };
/** la caméra principale : tribune principale, dans l'axe de la ligne médiane, 20 m derrière la ligne de touche, 15 m de haut */
export const CAMERA_PRINCIPALE = { x: 0, y: -(PELOUSE.l / 2 + 20), z: 15 };
/** les points de mesure : 5 le long du terrain, 3 en largeur (une grille réelle a un pas de 10 m environ) */
export const POINTS = (() => {
  const out = [];
  for (const y of [-25, 0, 25]) for (const x of [-45, -22.5, 0, 22.5, 45]) out.push({ x, y });
  return out;
})();
/** le projecteur de stade : LED de 1 500 W, faisceau de 30° (ordre de grandeur) */
export const PROJ_STADE = { watts: 1500, famille: 'led', rendement: 0.8, angle: 30 };
export const I_PROJ_STADE = intensiteDuFlux(flux(PROJ_STADE.watts, PROJ_STADE.famille) * PROJ_STADE.rendement, PROJ_STADE.angle);

/**
 * Les implantations : où sont les groupes de projecteurs (x, y, z en mètres).
 * @type {Array<{ id: string, nom: string, court: string, groupes: Array<{ x: number, y: number, z: number }> }>}
 */
export const IMPLANTATIONS = [
  {
    id: 'toit', nom: 'Rampes sous le bord du toit, sur les quatre côtés', court: 'Anneau de toit',
    groupes: [
      ...[-45, -30, -15, 0, 15, 30, 45].flatMap((x) => [{ x, y: -60, z: 35 }, { x, y: 60, z: 35 }]),
      ...[-20, 0, 20].flatMap((y) => [{ x: -75, y, z: 32 }, { x: 75, y, z: 32 }]),
    ],
  },
  {
    id: 'mats', nom: 'Quatre mâts aux coins du stade', court: 'Quatre mâts',
    groupes: [{ x: -68, y: -50, z: 45 }, { x: 68, y: -50, z: 45 }, { x: -68, y: 50, z: 45 }, { x: 68, y: 50, z: 45 }],
  },
  {
    id: 'face', nom: 'Une seule rampe, sur le toit de la tribune d\'en face', court: 'Tribune d\'en face',
    groupes: [-45, -30, -15, 0, 15, 30, 45].map((x) => ({ x, y: 60, z: 35 })),
  },
];
export const implantationById = (/** @type {string} */ id) => IMPLANTATIONS.find((i) => i.id === id) || IMPLANTATIONS[0];
/** les points visés par les projecteurs (chaque groupe partage les siens entre eux) */
const VISES = (() => {
  const out = [];
  for (const y of [-24, 0, 24]) for (const x of [-42, -21, 0, 21, 42]) out.push({ x, y });
  return out;
})();

/**
 * Les éclairements sur la grille de mesure.
 * @param {{ implantation: string, n: number, panne?: number, niveau?: number }} p n : nombre total de projecteurs ;
 *   panne : indice d'un groupe éteint (−1 ou absent : tout allumé) ; niveau : gradateur, 0 à 1
 * @returns {{ points: Array<{ x: number, y: number, eh: number, ev: number }>, eh: ReturnType<typeof uniformite>, ev: ReturnType<typeof uniformite>, parGroupe: number }}
 */
export function eclairementStade(p) {
  const imp = implantationById(p.implantation), G = imp.groupes, niveau = p.niveau ?? 1;
  const parGroupe = Math.max(0, p.n) / G.length, parVise = parGroupe / VISES.length;
  const I0 = I_PROJ_STADE * niveau, th = PROJ_STADE.angle, C = CAMERA_PRINCIPALE, h = 1;
  const points = POINTS.map((P) => {
    // plan vertical tourné vers la caméra : normale horizontale du point vers la caméra
    const nx = C.x - P.x, ny = C.y - P.y, nn = Math.hypot(nx, ny) || 1;
    let eh = 0, ev = 0;
    G.forEach((g, k) => {
      if (k === p.panne) return;
      const sx = g.x - P.x, sy = g.y - P.y, sz = g.z - h, d = Math.hypot(sx, sy, sz);
      for (const A of VISES) {
        // l'écart entre l'axe du projecteur (vers le point visé) et la direction du point mesuré
        const ax = A.x - g.x, ay = A.y - g.y, az = -g.z, da = Math.hypot(ax, ay, az);
        const cosA = (ax * -sx + ay * -sy + az * -sz) / (da * d);
        const I = I0 * parVise * profil(th, deg(Math.acos(Math.min(1, Math.max(-1, cosA)))));
        eh += I * (sz / d) / (d * d);
        ev += I * Math.max(0, (sx * nx + sy * ny) / (nn * d)) / (d * d);
      }
    });
    return { x: P.x, y: P.y, eh, ev };
  });
  return { points, eh: uniformite(points.map((q) => q.eh)), ev: uniformite(points.map((q) => q.ev)), parGroupe };
}
