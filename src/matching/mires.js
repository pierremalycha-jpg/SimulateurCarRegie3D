// @ts-check
// ----------------------------------------------------------------------------------
// Les mires du matching (v19.30). Une mire = une grille de pastilles de couleur connues, filmée par
// les caméras à raccorder. La ColorChecker Classic (24 pastilles, 4 lignes × 6 colonnes) : dix-huit
// couleurs (deux carnations, ciel, feuillage, six couleurs franches…) et six gris, du blanc au noir.
// Les valeurs sont les valeurs usuelles publiées (moyennes BabelColor, en sRGB 8 bits) : des ordres
// de grandeur, suffisants pour un raccord relatif (une caméra sur l'autre) ; pour un raccord absolu
// sur la mire, on prendrait les valeurs mesurées de son exemplaire. Les gris portent leur luminance
// linéaire relative (L, 1 = réflecteur parfait) : c'est sur eux que se lisent le noir, la balance,
// l'exposition et le gamma ; les couleurs servent à la matrice.
// ----------------------------------------------------------------------------------

/** sRGB 8 bits → linéaire (même primaires que BT.709) */
export function srgbLineaire(v) { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
/** luminance BT.709 d'un triplet linéaire */
export const luma709 = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * @typedef {{ id: string, nom: string, srgb: [number, number, number], lin: [number, number, number], L: number, neutre: boolean }} PastilleMire
 * @typedef {{ id: string, nom: string, lignes: number, colonnes: number, pastilles: PastilleMire[] }} Mire
 */

/** @type {[string, string, [number, number, number]][]} ligne par ligne, de gauche à droite */
const CLASSIC = [
  ['peau-sombre', 'Peau sombre', [115, 82, 68]], ['peau-claire', 'Peau claire', [194, 150, 130]], ['ciel', 'Ciel', [98, 122, 157]],
  ['feuillage', 'Feuillage', [87, 108, 67]], ['fleur-bleue', 'Fleur bleue', [133, 128, 177]], ['vert-bleu', 'Vert bleuté', [103, 189, 170]],
  ['orange', 'Orange', [214, 126, 44]], ['bleu-violace', 'Bleu violacé', [80, 91, 166]], ['rouge-modere', 'Rouge modéré', [193, 90, 99]],
  ['violet', 'Violet', [94, 60, 108]], ['vert-jaune', 'Vert jaune', [157, 188, 64]], ['jaune-orange', 'Jaune orangé', [224, 163, 46]],
  ['bleu', 'Bleu', [56, 61, 150]], ['vert', 'Vert', [70, 148, 73]], ['rouge', 'Rouge', [175, 54, 60]],
  ['jaune', 'Jaune', [231, 199, 31]], ['magenta', 'Magenta', [187, 86, 149]], ['cyan', 'Cyan', [8, 133, 161]],
  ['blanc', 'Blanc (9,5)', [243, 243, 242]], ['gris-8', 'Gris 8', [200, 200, 200]], ['gris-65', 'Gris 6,5', [160, 160, 160]],
  ['gris-5', 'Gris 5', [122, 122, 121]], ['gris-35', 'Gris 3,5', [85, 85, 85]], ['noir', 'Noir (2)', [52, 52, 52]],
];

/** @param {string} id @param {string} nom @param {number} lignes @param {number} colonnes @param {[string, string, [number, number, number]][]} liste @returns {Mire} */
function mire(id, nom, lignes, colonnes, liste) {
  return {
    id, nom, lignes, colonnes,
    pastilles: liste.map(([pid, pnom, srgb]) => {
      const lin = /** @type {[number, number, number]} */ (srgb.map(srgbLineaire));
      // un gris : les trois voies à moins de 3 % l'une de l'autre (sur la mire, pas sur la caméra)
      const neutre = Math.max(...srgb) - Math.min(...srgb) <= 3;
      return { id: pid, nom: pnom, srgb, lin, L: luma709(lin[0], lin[1], lin[2]), neutre };
    }),
  };
}

/** @type {Record<string, Mire>} */
export const MIRES = {
  colorchecker: mire('colorchecker', 'ColorChecker Classic (24 pastilles)', 4, 6, CLASSIC),
};
export const MIRE_DEFAUT = 'colorchecker';

/** les pastilles neutres d'une mire, du plus clair au plus sombre */
export const neutres = (m) => m.pastilles.filter((p) => p.neutre).sort((a, b) => b.L - a.L);
/** les pastilles colorées */
export const colorees = (m) => m.pastilles.filter((p) => !p.neutre);
/** position (ligne, colonne) d'une pastille par son index dans la liste */
export const position = (m, index) => ({ ligne: Math.floor(index / m.colonnes), colonne: index % m.colonnes });
