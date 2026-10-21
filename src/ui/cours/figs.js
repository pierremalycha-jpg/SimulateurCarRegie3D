// @ts-check
// ----------------------------------------------------------------------------------
// Schémas des fiches de cours : SVG dessinés en code (hors ligne), dans les couleurs des fiches
// « ? » (ui/term_figs.js) : gris clair pour le câble coaxial, ambre pour les repères, violet pour
// les données annexes, bleu et rouge pour les différences de couleur.
// ----------------------------------------------------------------------------------
const FG = '#e7eaed', MUTED = '#9aa3ab', LINE = '#4a5560', AMB = '#f0a61c', VIO = '#c77dff', BOX = '#1c2126', COAX = '#cfd6dd', CB = '#5ea8ff', CR = '#ff6b5e', GRN = '#2fbf5a';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" fill="${o.c || FG}" font-size="${o.s || 12}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.w ? ` font-weight="${o.w}"` : ''}${o.m ? ' font-family="B612 Mono, ui-monospace, monospace"' : ''}>${esc(s)}</text>`;
const R = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 4}" fill="${o.f || BOX}" stroke="${o.s || LINE}" stroke-width="${o.sw || 1}"/>`;
const L = (x1, y1, x2, y2, o = {}) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.c || LINE}" stroke-width="${o.w || 1.5}"${o.arrow ? ' marker-end="url(#co-a)"' : ''}/>`;
const node = (x, y, w, h, title, sub) => R(x, y, w, h) + T(x + w / 2, y + (sub ? h / 2 - 2 : h / 2 + 4), title, { a: 'middle', w: 600, s: 12.5 }) + (sub ? T(x + w / 2, y + h / 2 + 13, sub, { a: 'middle', c: MUTED, s: 11 }) : '');
const svg = (w, h, body, title) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}" font-family="Archivo, 'Segoe UI', sans-serif"><defs><marker id="co-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${LINE}"/></marker></defs>${body}</svg>`;
// connecteur BNC vu de côté
const bnc = (x, y) => R(x - 6, y - 7, 12, 14, { f: '#8d969e', s: '#5b646c', r: 2 });

/** @type {Record<string, () => string>} */
export const COURS_FIGS = {
  // une liaison SDI, puis le contenu d'une ligne d'image dans le flux
  sdi() {
    let b = T(16, 18, 'Une liaison SDI : une sortie, un câble, une entrée', { c: MUTED, s: 11.5 });
    b += node(16, 32, 88, 46, 'CCU', 'sortie SDI');
    b += L(110, 55, 310, 55, { c: COAX, w: 5 }) + bnc(110, 55) + bnc(310, 55);
    const bits = '1 0 1 1 0 0 1 0 1 1 1 0';
    b += T(210, 44, bits, { a: 'middle', m: 1, s: 11, c: GRN });
    b += T(210, 76, 'coaxial 75 Ω, bits en série', { a: 'middle', s: 11 });
    b += T(210, 91, 'portée : ≈ 150 m en HD, 120 m en 3G, 70 m en 12G', { a: 'middle', s: 10.5, c: MUTED });
    b += node(316, 32, 88, 46, 'Grille', 'une entrée');
    b += L(404, 55, 428, 55, { arrow: 1 }) + node(432, 32, 92, 46, 'Mélangeur', '');
    // la ligne d'image
    b += T(16, 124, 'Ce que contient une ligne d\'image en HD', { c: MUTED, s: 11.5 });
    const y = 134, h = 34;
    b += R(20, y, 36, h, { f: '#3a2a0a', s: AMB, r: 2 }) + T(38, y + 21, 'EAV', { a: 'middle', s: 11, w: 700, c: AMB });
    b += R(56, y, 44, h, { f: '#22282e', r: 2 }) + T(78, y + 15, 'n° ligne', { a: 'middle', s: 9.5, c: MUTED }) + T(78, y + 27, 'CRC', { a: 'middle', s: 10.5 });
    b += R(100, y, 100, h, { f: '#2a1d36', s: VIO, r: 2 }) + T(150, y + 21, 'Données annexes', { a: 'middle', s: 11, c: VIO, w: 600 });
    b += R(200, y, 36, h, { f: '#3a2a0a', s: AMB, r: 2 }) + T(218, y + 21, 'SAV', { a: 'middle', s: 11, w: 700, c: AMB });
    const cells = ['Cb', 'Y', 'Cr', 'Y', 'Cb', 'Y', 'Cr', 'Y', 'Cb', 'Y', 'Cr'];
    const cw = 284 / 12;
    cells.forEach((c, i) => { const col = c === 'Y' ? FG : c === 'Cb' ? CB : CR; b += R(236 + i * cw, y, cw, h, { f: '#15191d', s: '#2c343b', r: 0 }) + T(236 + i * cw + cw / 2, y + 21, c, { a: 'middle', s: 10.5, w: 600, c: col }); });
    b += R(236 + 11 * cw, y, cw, h, { f: '#15191d', s: '#2c343b', r: 0 }) + T(236 + 11.5 * cw, y + 21, '…', { a: 'middle', c: MUTED });
    // accolades
    const brace = (x1, x2, yy) => `<path d="M${x1} ${yy - 5} V${yy} H${x2} V${yy - 5}" fill="none" stroke="${MUTED}" stroke-width="1"/>`;
    b += brace(20, 236, 178) + T(128, 194, 'suppression : repères et données', { a: 'middle', s: 11 });
    b += brace(236, 520, 178) + T(378, 194, 'image active : 1 920 pixels', { a: 'middle', s: 11 });
    b += T(20, 216, '- son embeddé (16 canaux en HD)', { s: 11, c: MUTED }) + T(20, 231, '- timecode, identifiant du format', { s: 11, c: MUTED });
    b += T(248, 216, 'Y : luminance de chaque pixel', { s: 11, c: MUTED }) + T(248, 231, 'Cb, Cr : couleur, une pour deux pixels (4:2:2)', { s: 11, c: MUTED });
    b += T(16, 258, 'Puis la ligne suivante : 1 125 lignes par image en 1080, dont 1 080 d\'image.', { s: 11 });
    return svg(540, 268, b, 'Une liaison SDI et le contenu d\'une ligne d\'image');
  },
};
