// @ts-check
// ----------------------------------------------------------------------------------
// Texte qui tient dans sa place : sur les textures du monde 3D (bandeaux de tribune, banderoles,
// enseignes, étiquettes, panneaux), un texte trop long était coupé au bord du canvas. Ici la
// police est réduite jusqu'à ce que le texte tienne dans la largeur voulue (en dernier recours, un
// léger resserrement horizontal par le maxWidth du canvas, jamais une coupure).
// ----------------------------------------------------------------------------------

/** pile de polices des textures du monde (intégrées à la page par tools/build.mjs) */
export const WORLD_FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';

/**
 * La taille de police (px) à laquelle `text` tient dans `maxW` : `size` si c'est déjà le cas,
 * sinon réduite (pas de 2 %), jamais sous `min`. Laisse le contexte réglé sur cette police.
 * @param {{ font: string, measureText: (t: string) => { width: number } }} g
 * @param {string} text @param {number} maxW @param {number} size
 * @param {number | string} [weight] @param {string} [family] @param {number} [min]
 */
export function fitSize(g, text, maxW, size, weight = 700, family = WORLD_FONT, min = 6) {
  let s = size;
  g.font = `${weight} ${s}px ${family}`;
  for (let i = 0; i < 80 && s > min && g.measureText(text).width > maxW; i++) {
    s = Math.max(min, Math.floor(s * 0.98 * 100) / 100);
    g.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

/**
 * Écrit `text` en (x, y) à la plus grande taille ≤ `size` qui tienne dans `maxW` (alignement et
 * ligne de base : ceux du contexte). Avec `stroke`, un contour est tracé avant le remplissage.
 * @param {CanvasRenderingContext2D} g @param {string} text @param {number} x @param {number} y
 * @param {number} maxW @param {number} size
 * @param {{ weight?: number | string, family?: string, min?: number, stroke?: boolean }} [o]
 * @returns {number} la taille retenue
 */
export function fillFit(g, text, x, y, maxW, size, o = {}) {
  const s = fitSize(g, text, maxW, size, o.weight ?? 700, o.family ?? WORLD_FONT, o.min ?? 6);
  if (o.stroke) g.strokeText(text, x, y, maxW);
  g.fillText(text, x, y, maxW);
  return s;
}

/**
 * Plusieurs lignes centrées autour de y (interligne 1,1), chacune ajustée, toutes à la même taille.
 * @param {CanvasRenderingContext2D} g @param {string[]} lines @param {number} x @param {number} y
 * @param {number} maxW @param {number} maxH @param {number} size
 * @param {{ weight?: number | string, family?: string }} [o]
 */
export function fillLines(g, lines, x, y, maxW, maxH, size, o = {}) {
  const w = o.weight ?? 700, f = o.family ?? WORLD_FONT;
  let s = Math.min(size, maxH / (lines.length * 1.1));
  for (const l of lines) s = Math.min(s, fitSize(g, l, maxW, s, w, f));
  g.font = `${w} ${s}px ${f}`;
  lines.forEach((l, i) => g.fillText(l, x, y + (i - (lines.length - 1) / 2) * s * 1.1, maxW));
  return s;
}
