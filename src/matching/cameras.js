// @ts-check
// ----------------------------------------------------------------------------------
// Les caméras du matching (v19.30) : ce que chaque modèle sait régler, dans quelles bornes, et comment
// on y accède. Un réglage porte sa grandeur physique (dB de gain, point de noir, coefficient de matrice,
// exposant de gamma, kelvin, pour cent de saturation) et son échelle (pas du menu par unité physique).
// Les constructeurs ne publient pas ces échelles : celles-ci sont des estimations de départ (`estime`), et
// la page les affine à chaque tour en comparant ce qu'elle a demandé et ce qu'elle remesure
// (calc.js : estimerEchelle). Un réglage `absolu` se donne en valeur (0,45 ; 5600 K), pas en écart.
// Pilotage : `cgi` = la page envoie les commandes HTTP elle-même (Panasonic AW, spécification d'interface
// HD Integrated Camera V1.06, octobre 2015, et AW-UE20 à vérifier) ; `manuel` = les valeurs s'affichent, on
// les entre sur le pupitre (Sony RCP-1500 sur HXCU-FB80 : pas d'accès public à la CCU ; l'adaptateur CNA-1
// et son « Simple Protocol » le permettraient, sur licence et documentation Sony).
// ----------------------------------------------------------------------------------

/**
 * @typedef {'dB'|'point'|'coef'|'exposant'|'kelvin'|'pourcent'} Grandeur
 * @typedef {{ lib: string, min: number, max: number, grandeur: Grandeur, echelle?: number, estime?: boolean, absolu?: boolean, pas?: number, note?: string }} Reglage
 * @typedef {{ id: string, nom: string, court: string, pilotage: 'cgi'|'manuel'|'aucun', famille?: 'he130'|'ue20', aVerifier?: boolean, note?: string,
 *   reglages: { gainR?: Reglage, gainB?: Reglage, pedestal?: Reglage, pedestalR?: Reglage, pedestalB?: Reglage, gamma?: Reglage, temperature?: Reglage, matrice?: Reglage, saturation?: Reglage } }} Camera
 */

const PANASONIC_HE130 = /** @type {Camera} */ ({
  id: 'he130', nom: 'Panasonic AW-HE130', court: 'HE130', pilotage: 'cgi', famille: 'he130',
  note: 'Menu PAINT par HTTP (aw_cam) : gains, pedestal, gamma 0,30 à 0,75, matrice linéaire (type User), 12 axes, température de couleur (mode VAR), chroma.',
  reglages: {
    gainR: { lib: 'R GAIN', min: -150, max: 150, grandeur: 'dB', echelle: 20, estime: true },
    gainB: { lib: 'B GAIN', min: -150, max: 150, grandeur: 'dB', echelle: 20, estime: true },
    pedestal: { lib: 'PEDESTAL', min: -150, max: 150, grandeur: 'point', echelle: 10, estime: true },
    pedestalR: { lib: 'R PEDESTAL', min: -100, max: 100, grandeur: 'point', echelle: 10, estime: true },
    pedestalB: { lib: 'B PEDESTAL', min: -100, max: 100, grandeur: 'point', echelle: 10, estime: true },
    gamma: { lib: 'GAMMA', min: 0.3, max: 0.75, grandeur: 'exposant', absolu: true, pas: 0.01, note: 'exposant du menu (0,45 ≈ BT.709)' },
    temperature: { lib: 'COLOR TEMPERATURE', min: 2000, max: 15000, grandeur: 'kelvin', absolu: true, note: 'balance en mode VAR' },
    matrice: { lib: 'LINEAR MATRIX', min: -63, max: 63, grandeur: 'coef', echelle: 100, estime: true, note: 'MATRIX TYPE sur User' },
    saturation: { lib: 'CHROMA LEVEL', min: -99, max: 40, grandeur: 'pourcent', absolu: true, note: 'en % autour de 0' },
  },
});

const PANASONIC_UE20 = /** @type {Camera} */ ({
  id: 'ue20', nom: 'Panasonic AW-UE20', court: 'UE20', pilotage: 'cgi', famille: 'ue20', aVerifier: true,
  note: 'Caméra d\'entrée de gamme : gains R et B, pedestal, chroma par HTTP (syntaxe des AW-HE40 / UE70, à vérifier avec la spécification AW-UE20) ; pas de matrice linéaire, gamma par types seulement : ce qui reste se corrige en aval (LUT).',
  reglages: {
    gainR: { lib: 'R GAIN', min: -30, max: 30, grandeur: 'dB', echelle: 5, estime: true },
    gainB: { lib: 'B GAIN', min: -30, max: 30, grandeur: 'dB', echelle: 5, estime: true },
    pedestal: { lib: 'PEDESTAL', min: -10, max: 10, grandeur: 'point', echelle: 1, estime: true },
    saturation: { lib: 'CHROMA LEVEL', min: -3, max: 3, grandeur: 'pourcent', absolu: true, estime: true, note: 'sept positions, de −3 à +3' },
  },
});

const SONY_FB80 = /** @type {Camera} */ ({
  id: 'fb80', nom: 'Sony HXC-FB80 (HXCU-FB80, RCP-1500)', court: 'FB80', pilotage: 'manuel',
  note: 'Tout se règle au RCP-1500 : WHITE R et B, BLACK R et B, master black, gamma, page P14 USER MATRIX (R-G, R-B, G-R, G-B, B-R, B-G), P06 SATURATION ; la multi-matrix pour une teinte seule.',
  reglages: {
    gainR: { lib: 'WHITE R', min: -99, max: 99, grandeur: 'dB', echelle: 12, estime: true },
    gainB: { lib: 'WHITE B', min: -99, max: 99, grandeur: 'dB', echelle: 12, estime: true },
    pedestal: { lib: 'MASTER BLACK', min: -99, max: 99, grandeur: 'point', echelle: 10, estime: true },
    pedestalR: { lib: 'BLACK R', min: -99, max: 99, grandeur: 'point', echelle: 10, estime: true },
    pedestalB: { lib: 'BLACK B', min: -99, max: 99, grandeur: 'point', echelle: 10, estime: true },
    gamma: { lib: 'MASTER GAMMA', min: 0.35, max: 0.9, grandeur: 'exposant', absolu: true, pas: 0.01, estime: true, note: 'exposant du menu PAINT (table STD) ; au RCP, le bouton GAMMA' },
    temperature: { lib: 'WHITE (température)', min: 2000, max: 15000, grandeur: 'kelvin', absolu: true, note: 'à défaut, WHITE R et B' },
    matrice: { lib: 'USER MATRIX', min: -99, max: 99, grandeur: 'coef', echelle: 100, estime: true, note: 'page P14, MATRIX sur ON (P01)' },
    saturation: { lib: 'SATURATION', min: -99, max: 99, grandeur: 'pourcent', absolu: true, note: 'page P06, en % autour de 0' },
  },
});

const AUTRE = /** @type {Camera} */ ({
  id: 'autre', nom: 'Autre caméra (valeurs physiques)', court: 'Autre', pilotage: 'aucun',
  note: 'Les écarts s\'affichent en dB, points, exposant et coefficients : à reporter dans les menus de la caméra.',
  reglages: {
    gainR: { lib: 'Gain R', min: -99, max: 99, grandeur: 'dB', echelle: 1 }, gainB: { lib: 'Gain B', min: -99, max: 99, grandeur: 'dB', echelle: 1 },
    pedestal: { lib: 'Master black', min: -99, max: 99, grandeur: 'point', echelle: 1 }, pedestalR: { lib: 'Noir R', min: -99, max: 99, grandeur: 'point', echelle: 1 }, pedestalB: { lib: 'Noir B', min: -99, max: 99, grandeur: 'point', echelle: 1 },
    gamma: { lib: 'Gamma', min: 0.2, max: 1.2, grandeur: 'exposant', absolu: true, pas: 0.01 },
    temperature: { lib: 'Température de couleur', min: 2000, max: 15000, grandeur: 'kelvin', absolu: true },
    matrice: { lib: 'Matrice', min: -1, max: 1, grandeur: 'coef', echelle: 1, pas: 0.01 },
    saturation: { lib: 'Saturation', min: -99, max: 99, grandeur: 'pourcent', absolu: true },
  },
});

/** @type {Record<string, Camera>} */
export const CAMERAS = { he130: PANASONIC_HE130, ue20: PANASONIC_UE20, fb80: SONY_FB80, autre: AUTRE };
export const CAMERA_DEFAUT_A = 'fb80';
export const CAMERA_DEFAUT_B = 'he130';

/** arrondit au pas du réglage et borne aux limites du menu */
export function borner(reglage, v) {
  const pas = reglage.pas || 1;
  return Math.min(reglage.max, Math.max(reglage.min, Math.round(v / pas) * pas));
}
/** un écart physique (dB, point, coefficient) en pas du menu, avec l'échelle connue (ou apprise) */
export function enUnites(reglage, delta, echelle = reglage.echelle || 1) { return Math.round(delta * echelle); }
/** la valeur à afficher à l'opérateur, dans l'unité du réglage */
export function formatValeur(reglage, v) {
  switch (reglage.grandeur) {
    case 'dB': return `${v >= 0 ? '+' : ''}${v.toFixed(2)} dB`;
    case 'point': return `${v >= 0 ? '+' : ''}${v.toFixed(2)} point`;
    case 'coef': return `${v >= 0 ? '+' : ''}${v.toFixed(3)}`;
    case 'exposant': return v.toFixed(2);
    case 'kelvin': return `${Math.round(v)} K`;
    case 'pourcent': return `${v >= 0 ? '+' : ''}${v.toFixed(0)} %`;
    default: return String(v);
  }
}
