// @ts-check
// ----------------------------------------------------------------------------------
// Le matching à la mire (v19.30) : calcul pur, sans DOM. Deux caméras filment la même mire sous la
// même lumière ; on mesure la couleur de chaque pastille sur chacune (R'G'B' tels que la caméra les
// sort, BT.709, de 0 à 1), et l'on calcule ce qu'il faut régler sur la seconde (B, à raccorder) pour
// qu'elle rende les mêmes couleurs que la première (A, la référence), dans l'ordre du line-up :
//   1. les noirs (pedestal : master, R, B), lus sur la courbe des gris ;
//   2. la balance des blancs (gain R, gain B), lue sur les gris aussi, et la température de couleur ;
//   3. l'exposition (le diaph), lue sur le blanc ;
//   4. le gamma (l'exposant), lu sur la forme de l'escalier des gris ;
//   5. la matrice (R-G, R-B, G-R, G-B, B-R, B-G), ajustée aux moindres carrés sur les couleurs, une
//      fois les deux caméras linéarisées par leur propre courbe ; et la saturation seule ;
//   6. ce qui reste, teinte par teinte (multi-matrix, 12 axes) ;
//   7. l'écart : ΔE (CIE76, Lab D65) avant, et prévu après, pastille par pastille.
// Chaque caméra est décrite, voie par voie, par V = noir + gain · L^g (L : luminance de la pastille
// sur la mire). Ce modèle linéarise la caméra, sans rien savoir de son électronique : les unités des
// menus (un pas de gain, un pas de matrice) ne sont pas publiées, et la page apprend leur échelle en
// comparant ce qu'elle a demandé et ce qu'elle remesure (estimerEchelle).
// Références : ITU-R BT.709-6 (OETF, luminance, différences de couleur), CIE 1976 L*a*b* (ΔE),
// McCamy 1992 (température de couleur proximale), matrice sous la forme des réglages des caméras
// (chaque voie reçoit une part de sa différence avec les deux autres : le blanc ne bouge pas).
// ----------------------------------------------------------------------------------
import { neutres, colorees, luma709 } from './mires.js';

/** @typedef {import('./mires.js').Mire} Mire */
/** @typedef {{ id: string, r: number, g: number, b: number }} Pastille mesure d'une pastille, R'G'B' 0..1 */
/** @typedef {{ pastilles: Pastille[] }} Mesure */
/** @typedef {{ g: number, gain: number, noir: number, sse: number }} Courbe V = noir + gain · L^g */
/** @typedef {{ r: Courbe, g: Courbe, b: Courbe, gamma: number, cct: number }} Caracterisation */
/** @typedef {{ rg: number, rb: number, gr: number, gb: number, br: number, bg: number }} Coefs matrice, forme des réglages */

// ---------------- BT.709, Lab, température ----------------
/** OETF BT.709 : lumière linéaire → signal */
export const oetf709 = (L) => (L < 0.018 ? 4.5 * L : 1.099 * Math.pow(Math.max(0, L), 0.45) - 0.099);
/** l'inverse : signal → lumière linéaire */
export const oetf709Inv = (V) => (V < 0.081 ? V / 4.5 : Math.pow((Math.max(0, V) + 0.099) / 1.099, 1 / 0.45));
/** Y'CbCr BT.709 depuis R'G'B' (0..1) : Cb et Cr entre −0,5 et +0,5 */
export function ycbcr(r, g, b) { const y = 0.2126 * r + 0.7152 * g + 0.0722 * b; return { y, cb: (b - y) / 1.8556, cr: (r - y) / 1.5748 }; }
/** XYZ (D65) depuis RGB linéaire BT.709 */
export function xyz709(r, g, b) {
  return { x: 0.4124 * r + 0.3576 * g + 0.1805 * b, y: 0.2126 * r + 0.7152 * g + 0.0722 * b, z: 0.0193 * r + 0.1192 * g + 0.9505 * b };
}
const fLab = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
/** L*a*b* (blanc D65) depuis XYZ */
export function lab(x, y, z) {
  const fx = fLab(x / 0.95047), fy = fLab(y), fz = fLab(z / 1.08883);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
/** Lab depuis un triplet linéaire BT.709 */
export const labLineaire = (r, g, b) => { const c = xyz709(r, g, b); return lab(c.x, c.y, c.z); };
/** ΔE CIE76 */
export const deltaE = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
/** température de couleur proximale (McCamy) depuis la chromaticité x, y ; 0 si hors domaine */
export function cctXy(x, y) {
  const n = (x - 0.332) / (0.1858 - y);
  const t = 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33;
  return t > 1000 && t < 25000 ? t : 0;
}
/** température de couleur d'un triplet linéaire (un gris vu par la caméra) */
export function cctLineaire(r, g, b) { const c = xyz709(r, g, b); const s = c.x + c.y + c.z; return s > 0 ? cctXy(c.x / s, c.y / s) : 0; }
export const mireds = (K) => (K > 0 ? 1e6 / K : 0);

// ---------------- la courbe des gris ----------------
/** régression V = a·X + b */
function regression(X, V) {
  const n = X.length; let sx = 0, sv = 0, sxx = 0, sxv = 0;
  for (let i = 0; i < n; i++) { sx += X[i]; sv += V[i]; sxx += X[i] * X[i]; sxv += X[i] * V[i]; }
  const d = n * sxx - sx * sx; if (Math.abs(d) < 1e-12) return { a: 0, b: sv / n, sse: Infinity };
  const a = (n * sxv - sx * sv) / d, b = (sv - a * sx) / n;
  let sse = 0; for (let i = 0; i < n; i++) sse += (V[i] - a * X[i] - b) ** 2;
  return { a, b, sse };
}
/**
 * Ajuste V = noir + gain · L^g sur des points (L : luminance de la mire, V : valeur mesurée) : grille sur
 * l'exposant g puis affinage, régression linéaire pour le gain et le noir à chaque g. Trois points au moins.
 * @param {{ L: number, V: number }[]} pts @returns {Courbe}
 */
export function ajusterCourbe(pts) {
  const V = pts.map((p) => p.V); let best = /** @type {Courbe} */ ({ g: 1, gain: 1, noir: 0, sse: Infinity });
  const essai = (g) => { const r = regression(pts.map((p) => Math.pow(Math.max(p.L, 1e-6), g)), V); if (r.sse < best.sse) best = { g, gain: r.a, noir: r.b, sse: r.sse }; };
  for (let g = 0.2; g <= 1.6001; g += 0.05) essai(g);
  for (const pas of [0.005, 0.0005]) { const c = best.g; for (let g = c - 10 * pas; g <= c + 10 * pas + 1e-9; g += pas) essai(g); }
  return best;
}
/** la même courbe avec un exposant imposé : le gain et le noir seuls se règlent (régression linéaire) @returns {Courbe} */
export function ajusterCourbeG(pts, g) { const r = regression(pts.map((p) => Math.pow(Math.max(p.L, 1e-6), g)), pts.map((p) => p.V)); return { g, gain: r.a, noir: r.b, sse: r.sse }; }
/** la lumière linéaire (en unités de la mire) qui a donné V sur une voie décrite par la courbe */
export const lineariser = (c, V) => Math.pow(Math.max(0, (V - c.noir) / (c.gain || 1e-9)), 1 / c.g);
/** la valeur que donne cette voie pour une lumière L */
export const encoder = (c, L) => c.noir + c.gain * Math.pow(Math.max(0, L), c.g);

/**
 * Décrit une caméra d'après sa mesure de la mire : une courbe par voie sur les gris, le gamma (la voie verte,
 * qui porte la luminance), la température de couleur lue sur les gris moyens (linéarisés sans balance).
 * @param {Mesure} mesure @param {Mire} mire @returns {Caracterisation}
 */
export function caracteriser(mesure, mire) {
  const par = Object.fromEntries(mesure.pastilles.map((p) => [p.id, p]));
  const gris = neutres(mire).filter((p) => par[p.id]);
  if (gris.length < 3) throw new Error('Il faut au moins trois gris mesurés');
  const pts = (k) => gris.map((p) => ({ L: p.L, V: par[p.id][k] }));
  // un seul exposant pour les trois voies (la caméra applique la même courbe à chacune) : la moyenne des trois
  // ajustements, puis le gain et le noir de chaque voie avec cet exposant (le noir, extrapolé sous la pastille la plus
  // sombre, est ce que le bruit abîme le plus : l'exposant partagé le stabilise)
  const gs = ['r', 'g', 'b'].map((k) => ajusterCourbe(pts(k)).g), gamma = (gs[0] + gs[1] + gs[2]) / 3;
  const r = ajusterCourbeG(pts('r'), gamma), g = ajusterCourbeG(pts('g'), gamma), b = ajusterCourbeG(pts('b'), gamma);
  // la couleur du gris vu par la caméra : les gains relatifs des voies, en lumière linéaire
  const cct = cctLineaire(r.gain, g.gain, b.gain);
  return { r, g, b, gamma, cct };
}

// ---------------- la matrice ----------------
/** résout aux moindres carrés y ≈ a·x1 + b·x2 */
function deux(x1, x2, y) {
  let s11 = 0, s12 = 0, s22 = 0, s1y = 0, s2y = 0;
  for (let i = 0; i < y.length; i++) { s11 += x1[i] * x1[i]; s12 += x1[i] * x2[i]; s22 += x2[i] * x2[i]; s1y += x1[i] * y[i]; s2y += x2[i] * y[i]; }
  const d = s11 * s22 - s12 * s12; if (Math.abs(d) < 1e-12) return [0, 0];
  return [(s1y * s22 - s2y * s12) / d, (s2y * s11 - s1y * s12) / d];
}
/**
 * La matrice qui rapproche les couleurs de B (sources, linéaires) de celles de A (cibles) : R' = R + rg·(R−G) +
 * rb·(R−B), G' = G + gr·(G−R) + gb·(G−B), B' = B + br·(B−R) + bg·(B−G). Six coefficients, le blanc et les gris ne
 * bougent pas. Chaque ligne se résout seule (deux inconnues).
 * @param {number[][]} cibles @param {number[][]} sources @returns {Coefs}
 */
export function ajusterMatrice(cibles, sources) {
  const col = (k) => sources.map((s) => s[k]);
  const R = col(0), G = col(1), B = col(2);
  const y = (k) => cibles.map((c, i) => c[k] - sources[i][k]);
  const [rg, rb] = deux(R.map((v, i) => v - G[i]), R.map((v, i) => v - B[i]), y(0));
  const [gr, gb] = deux(G.map((v, i) => v - R[i]), G.map((v, i) => v - B[i]), y(1));
  const [br, bg] = deux(B.map((v, i) => v - R[i]), B.map((v, i) => v - G[i]), y(2));
  return { rg, rb, gr, gb, br, bg };
}
/** applique une matrice (forme des réglages) à un triplet linéaire @param {Coefs} m @param {number[]} v */
export function appliquerMatrice(m, v) {
  const [r, g, b] = v;
  return [r + m.rg * (r - g) + m.rb * (r - b), g + m.gr * (g - r) + m.gb * (g - b), b + m.br * (b - r) + m.bg * (b - g)];
}
export const MATRICE_NULLE = /** @type {Coefs} */ ({ rg: 0, rb: 0, gr: 0, gb: 0, br: 0, bg: 0 });
/** la saturation seule : le facteur s qui rapproche les écarts au gris de B de ceux de A (moindres carrés) */
export function ajusterSaturation(cibles, sources) {
  let num = 0, den = 0;
  for (let i = 0; i < cibles.length; i++) {
    const ya = luma709(cibles[i][0], cibles[i][1], cibles[i][2]), yb = luma709(sources[i][0], sources[i][1], sources[i][2]);
    for (let k = 0; k < 3; k++) { const da = cibles[i][k] - ya, db = sources[i][k] - yb; num += da * db; den += db * db; }
  }
  return den > 0 ? num / den : 1;
}
/** sature (s > 1) ou désature un triplet linéaire autour de sa luminance @param {number} s @param {number[]} v */
export function saturer(s, v) { const [r, g, b] = v; const y = luma709(r, g, b); return [y + s * (r - y), y + s * (g - y), y + s * (b - y)]; }

// ---------------- le diagnostic ----------------
/** les six axes du vecteurscope (angle de Cr sur Cb, barres à 75 %) */
export const AXES = [['R', 103], ['Mg', 61], ['B', 347], ['Cy', 283], ['G', 241], ['Yl', 167]];
const angle = (cb, cr) => ((Math.atan2(cr, cb) * 180 / Math.PI) + 360) % 360;
const ecartAngle = (a, b) => ((a - b + 540) % 360) - 180;
/** l'axe du vecteurscope le plus proche d'une teinte */
export function axeDe(cb, cr) { const t = angle(cb, cr); let best = AXES[0]; for (const a of AXES) if (Math.abs(ecartAngle(t, a[1])) < Math.abs(ecartAngle(t, best[1]))) best = a; return best[0]; }

/** tolérances du raccord : la coupe ne se voit plus (ordres de grandeur du Cours et de la caméra en 3D) */
export const TOLERANCES = { deltaE: 2, noir: 0.5, gris: 1, vecto: 0.012 };

/**
 * @typedef {{ moyen: number, max: number, pire: string, vecto: number, parPastille: { id: string, dE: number, d: number }[] }} Ecart
 * @typedef {{
 *   A: Caracterisation, B: Caracterisation,
 *   noirs: { master: number, r: number, b: number },
 *   balance: { gainR: number, gainB: number, dbR: number, dbB: number, cctA: number, cctB: number, dMireds: number },
 *   exposition: { diaph: number },
 *   gamma: { gA: number, gB: number, facteur: number },
 *   matrice: Coefs, saturation: number,
 *   teintes: { id: string, axe: string, dTeinte: number, rapportChroma: number, d: number }[],
 *   ecart: { avant: Ecart, apres: Ecart }, ok: boolean,
 *   corrige: Mesure,
 * }} Diagnostic
 */

/** l'écart entre deux mesures, pastille par pastille : ΔE (Lab, signal décodé en BT.709) et distance au vecteurscope */
export function ecart(mesureA, mesureB) {
  const par = Object.fromEntries(mesureB.pastilles.map((p) => [p.id, p]));
  const parPastille = [];
  for (const a of mesureA.pastilles) {
    const b = par[a.id]; if (!b) continue;
    const la = labLineaire(oetf709Inv(a.r), oetf709Inv(a.g), oetf709Inv(a.b)), lb = labLineaire(oetf709Inv(b.r), oetf709Inv(b.g), oetf709Inv(b.b));
    const ya = ycbcr(a.r, a.g, a.b), yb = ycbcr(b.r, b.g, b.b);
    parPastille.push({ id: a.id, dE: deltaE(la, lb), d: Math.hypot(ya.cb - yb.cb, ya.cr - yb.cr) });
  }
  const n = parPastille.length || 1;
  const pire = parPastille.reduce((p, q) => (q.dE > p.dE ? q : p), parPastille[0] || { id: '', dE: 0, d: 0 });
  return { moyen: parPastille.reduce((s, p) => s + p.dE, 0) / n, max: pire.dE, pire: pire.id, vecto: Math.max(0, ...parPastille.map((p) => p.d)), parPastille };
}

/**
 * Le diagnostic complet : ce qu'il faut régler sur B pour rejoindre A.
 * @param {Mesure} mesureA @param {Mesure} mesureB @param {Mire} mire @returns {Diagnostic}
 */
export function diagnostic(mesureA, mesureB, mire) {
  const A = caracteriser(mesureA, mire), B = caracteriser(mesureB, mire);
  // 1. les noirs : en points (% du signal) ; B doit ajouter ce qui lui manque
  const dn = { r: (A.r.noir - B.r.noir) * 100, g: (A.g.noir - B.g.noir) * 100, b: (A.b.noir - B.b.noir) * 100 };
  const master = (dn.r + dn.g + dn.b) / 3;
  const noirs = { master, r: dn.r - master, b: dn.b - master };
  // 2. la balance : les gains relatifs des voies, en lumière ; facteur à appliquer au gain R et B de B
  const gainR = (A.r.gain / A.g.gain) / (B.r.gain / B.g.gain), gainB = (A.b.gain / A.g.gain) / (B.b.gain / B.g.gain);
  const balance = { gainR, gainB, dbR: 20 * Math.log10(gainR), dbB: 20 * Math.log10(gainB), cctA: A.cct, cctB: B.cct, dMireds: mireds(B.cct) - mireds(A.cct) };
  // 3. l'exposition : le gain de la voie verte (le blanc), en diaphragmes (positif : ouvrir B)
  const exposition = { diaph: Math.log2(A.g.gain / B.g.gain) };
  // 4. le gamma : l'exposant de B multiplié par ce facteur rejoint celui de A
  const gamma = { gA: A.gamma, gB: B.gamma, facteur: A.gamma / B.gamma };
  // 5. la matrice, sur les couleurs linéarisées par la courbe de chaque caméra (noir, gain, gamma ôtés)
  const parA = Object.fromEntries(mesureA.pastilles.map((p) => [p.id, p])), parB = Object.fromEntries(mesureB.pastilles.map((p) => [p.id, p]));
  const lin = (C, p) => [lineariser(C.r, p.r), lineariser(C.g, p.g), lineariser(C.b, p.b)];
  const coul = colorees(mire).filter((p) => parA[p.id] && parB[p.id]);
  const cibles = coul.map((p) => lin(A, parA[p.id])), sources = coul.map((p) => lin(B, parB[p.id]));
  const matrice = ajusterMatrice(cibles, sources);
  const saturation = ajusterSaturation(cibles, sources);
  // 6. ce qui reste après la matrice, teinte par teinte (au vecteurscope, signal BT.709)
  const teintes = coul.map((p, i) => {
    const c = appliquerMatrice(matrice, sources[i]);
    const ya = ycbcr(oetf709(cibles[i][0]), oetf709(cibles[i][1]), oetf709(cibles[i][2])), yb = ycbcr(oetf709(c[0]), oetf709(c[1]), oetf709(c[2]));
    const ca = Math.hypot(ya.cb, ya.cr), cb = Math.hypot(yb.cb, yb.cr);
    return { id: p.id, axe: axeDe(ya.cb, ya.cr), dTeinte: ecartAngle(angle(ya.cb, ya.cr), angle(yb.cb, yb.cr)), rapportChroma: cb > 1e-6 ? ca / cb : 1, d: Math.hypot(ya.cb - yb.cb, ya.cr - yb.cr) };
  }).sort((p, q) => q.d - p.d);
  // 7. l'écart : avant, et prévu une fois tout appliqué (B linéarisée, matricée, réencodée avec les courbes de A)
  const corrige = { pastilles: mesureB.pastilles.map((p) => { const c = appliquerMatrice(matrice, lin(B, p)); return { id: p.id, r: encoder(A.r, c[0]), g: encoder(A.g, c[1]), b: encoder(A.b, c[2]) }; }) };
  const avant = ecart(mesureA, mesureB), apres = ecart(mesureA, corrige);
  const ok = apres.moyen <= TOLERANCES.deltaE && apres.vecto <= TOLERANCES.vecto * 2;
  return { A, B, noirs, balance, exposition, gamma, matrice, saturation, teintes, ecart: { avant, apres }, ok, corrige };
}

/** raccordé : l'écart tient dans les tolérances */
export const raccorde = (e) => e.moyen <= TOLERANCES.deltaE && e.max <= TOLERANCES.deltaE * 2.5;

// ---------------- apprendre l'échelle d'un réglage ----------------
/**
 * Un réglage a été bougé de `unites` pas ; la grandeur mesurée est passée de `avant` à `apres`. Si l'effet est
 * net et du bon sens, l'échelle (pas par unité physique) est unites / (apres − avant) ; sinon on garde la valeur
 * de départ. Bornée pour qu'une mesure bruitée ne fasse pas dérailler le tour suivant.
 */
export function estimerEchelle(echelle, unites, avant, apres, { min = 1e-3 } = {}) {
  const d = apres - avant;
  if (!unites || Math.abs(d) < min) return echelle;
  const e = unites / d;
  if (!Number.isFinite(e) || e === 0) return echelle;
  // pas plus de ×4 ni ÷4 d'un tour à l'autre, signe libre (il n'est pas toujours celui qu'on croit)
  const borne = Math.min(Math.abs(echelle) * 4, Math.max(Math.abs(echelle) / 4, Math.abs(e)));
  return Math.sign(e) * borne;
}

// ---------------- géométrie : la mire dans l'image ----------------
/** résout un système linéaire n×n (Gauss, pivot partiel) */
function gauss(M, v) {
  const n = v.length, A = M.map((r, i) => [...r, v[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    if (Math.abs(A[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.map((r, i) => r[n] / r[i]);
}
/**
 * L'homographie qui envoie le carré unité (0,0) (1,0) (1,1) (0,1) sur quatre coins cliqués dans l'image (haut
 * gauche, haut droit, bas droit, bas gauche). Null si les points sont dégénérés.
 * @param {{ x: number, y: number }[]} coins @returns {number[] | null} h (8 coefficients, h33 = 1)
 */
export function homographie(coins) {
  if (!coins || coins.length !== 4) return null;
  const src = [[0, 0], [1, 0], [1, 1], [0, 1]], M = [], v = [];
  for (let i = 0; i < 4; i++) {
    const [u, w] = src[i], { x, y } = coins[i];
    M.push([u, w, 1, 0, 0, 0, -u * x, -w * x]); v.push(x);
    M.push([0, 0, 0, u, w, 1, -u * y, -w * y]); v.push(y);
  }
  return gauss(M, v);
}
/** le point de l'image qui correspond à (u, v) du carré unité */
export function projeter(h, u, v) {
  const d = h[6] * u + h[7] * v + 1;
  return { x: (h[0] * u + h[1] * v + h[2]) / d, y: (h[3] * u + h[4] * v + h[5]) / d };
}
/**
 * Les points à moyenner pour chaque pastille : le centre de chaque case (grille lignes × colonnes dans le carré
 * unité), sur une zone de `part` de la case (0,4 : le cœur, loin des bords), n × n points.
 * @returns {{ index: number, points: { x: number, y: number }[] }[]}
 */
export function zonesPastilles(h, lignes, colonnes, part = 0.4, n = 7) {
  const out = [];
  for (let i = 0; i < lignes; i++) for (let j = 0; j < colonnes; j++) {
    const points = [];
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const u = (j + 0.5 + part * ((a + 0.5) / n - 0.5)) / colonnes, v = (i + 0.5 + part * ((b + 0.5) / n - 0.5)) / lignes;
      points.push(projeter(h, u, v));
    }
    out.push({ index: i * colonnes + j, points });
  }
  return out;
}

// ---------------- une caméra simulée (démonstration, tests) ----------------
/**
 * @typedef {{ noir?: [number, number, number], gain?: [number, number, number], gamma?: number, matrice?: Coefs, saturation?: number, bruit?: number, graine?: number }} CameraSimulee
 */
/**
 * La mesure que donnerait une caméra décrite par ses défauts : matrice puis saturation sur la lumière de la
 * mire, puis, voie par voie, V = noir + gain · L^gamma, borné à [0, 1]. Sans défaut : BT.709 pur (gamma 0,45).
 * @param {Mire} mire @param {CameraSimulee} [c] @returns {Mesure}
 */
export function simulerCamera(mire, c = {}) {
  const noir = c.noir || [0, 0, 0], gain = c.gain || [1, 1, 1], g = c.gamma || 0.45, m = c.matrice || MATRICE_NULLE, s = c.saturation ?? 1;
  let seed = (c.graine ?? 1) >>> 0;
  const alea = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5; };
  return {
    pastilles: mire.pastilles.map((p) => {
      const l = saturer(s, appliquerMatrice(m, p.lin));
      const v = (k) => Math.min(1, Math.max(0, noir[k] + gain[k] * Math.pow(Math.max(0, l[k]), g) + (c.bruit || 0) * alea()));
      return { id: p.id, r: v(0), g: v(1), b: v(2) };
    }),
  };
}
